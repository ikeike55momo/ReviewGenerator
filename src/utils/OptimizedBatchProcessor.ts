/**
 * @file OptimizedBatchProcessor.ts
 * @description 最適化されたバッチ処理システム
 * 並列処理、キューイング、エラー回復機能を含む高性能レビュー生成システム
 * パフォーマンス最適化とスケーラビリティを重視した設計
 */

import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';

/**
 * バッチ処理設定の型定義
 */
interface BatchProcessingConfig {
  concurrency: number; // 並列数
  retryAttempts: number; // リトライ回数
  backoffDelay: number; // バックオフ遅延（ms）
  timeoutMs: number; // タイムアウト（ms）
  rateLimitPerSecond: number; // レート制限
}

/**
 * バッチ処理結果の型定義
 */
interface BatchResult<T> {
  success: T[];
  failed: {
    index: number;
    error: string;
    input: any;
  }[];
  statistics: {
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    totalProcessingTime: number;
  };
}

/**
 * レビュー生成リクエストの型定義
 */
interface ReviewGenerationRequest {
  index: number;
  csvConfig: CSVConfig;
  customPrompt?: string;
  seed: number;
}

/**
 * 🚀 最適化されたバッチ処理システム
 * 高性能・高可用性を実現する包括的なバッチ処理エンジン
 */
class OptimizedBatchProcessor {
  private config: BatchProcessingConfig;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;

  constructor(config: Partial<BatchProcessingConfig> = {}) {
    this.config = {
      concurrency: 3, // デフォルト3並列（Netlify制限考慮）
      retryAttempts: 2,
      backoffDelay: 1000,
      timeoutMs: 45000,
      rateLimitPerSecond: 10,
      ...config
    };
    
    this.rateLimiter = new RateLimiter(this.config.rateLimitPerSecond);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000
    });

    console.log('🚀 最適化バッチプロセッサー初期化:', this.config);
  }

  /**
   * 🔄 汎用バッチ処理の実行
   */
  async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    console.log(`🔄 バッチ処理開始: ${items.length}件 (並列数: ${this.config.concurrency})`);
    
    const results: BatchResult<R> = {
      success: [],
      failed: [],
      statistics: {
        totalProcessed: 0,
        successRate: 0,
        averageProcessingTime: 0,
        totalProcessingTime: 0
      }
    };

    // 並列処理のためのチャンク分割
    const chunks = this.chunkArray(items, this.config.concurrency);
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`📦 チャンク ${chunkIndex + 1}/${chunks.length} 処理中... (${chunk.length}件)`);
      
      const chunkPromises = chunk.map((item, itemIndex) => {
        const globalIndex = results.success.length + results.failed.length + itemIndex;
        return this.processItemWithRetry(item, globalIndex, processor);
      });

      const chunkResults = await Promise.allSettled(chunkPromises);
      
      chunkResults.forEach((result, itemIndex) => {
        const globalIndex = results.success.length + results.failed.length;
        
        if (result.status === 'fulfilled' && result.value.success) {
          results.success.push(result.value.data!);
        } else {
          const errorMessage = result.status === 'rejected' 
            ? result.reason?.message || String(result.reason)
            : result.value.error || 'Unknown error';
            
          results.failed.push({
            index: globalIndex,
            error: errorMessage,
            input: chunk[itemIndex]
          });
        }
        
        if (onProgress) {
          const completed = results.success.length + results.failed.length;
          onProgress(completed, items.length);
        }
      });

      // レート制限対応（最後のチャンク以外）
      if (chunkIndex < chunks.length - 1) {
        await this.rateLimiter.wait();
      }
    }

    // 統計情報の計算
    const endTime = Date.now();
    results.statistics = {
      totalProcessed: items.length,
      successRate: results.success.length / items.length,
      averageProcessingTime: (endTime - startTime) / items.length,
      totalProcessingTime: endTime - startTime
    };

    console.log('✅ バッチ処理完了:', {
      成功: results.success.length,
      失敗: results.failed.length,
      成功率: `${(results.statistics.successRate * 100).toFixed(1)}%`,
      総処理時間: `${results.statistics.totalProcessingTime}ms`,
      平均処理時間: `${results.statistics.averageProcessingTime.toFixed(1)}ms`
    });

    return results;
  }

  /**
   * 📝 レビュー生成専用のバッチ処理
   */
  async generateReviewsBatch(
    csvConfig: CSVConfig,
    reviewCount: number,
    anthropicApiKey: string,
    customPrompt?: string
  ): Promise<BatchResult<GeneratedReview>> {
    console.log(`📝 最適化レビューバッチ生成開始: ${reviewCount}件`);

    const reviewRequests: ReviewGenerationRequest[] = Array.from({ length: reviewCount }, (_, index) => ({
      index,
      csvConfig,
      customPrompt,
      seed: Math.random() // 多様性のためのシード値
    }));

    return this.processBatch(
      reviewRequests,
      async (request, index) => {
        return await this.generateSingleReview(request, anthropicApiKey);
      },
      (completed, total) => {
        const percentage = Math.round(completed / total * 100);
        console.log(`📊 レビュー生成進捗: ${completed}/${total} (${percentage}%)`);
      }
    );
  }

  /**
   * 🔄 リトライ機能付きアイテム処理
   */
  private async processItemWithRetry<T, R>(
    item: T,
    index: number,
    processor: (item: T, index: number) => Promise<R>
  ): Promise<{ success: boolean; data?: R; error?: string }> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // サーキットブレーカーのチェック
        if (this.circuitBreaker.isOpen()) {
          throw new Error('Circuit breaker is open - too many failures detected');
        }

        // タイムアウト付きで処理実行
        const result = await Promise.race([
          processor(item, index),
          this.createTimeoutPromise<R>(this.config.timeoutMs)
        ]);

        this.circuitBreaker.recordSuccess();
        return { success: true, data: result };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.circuitBreaker.recordFailure();

        console.warn(`⚠️ 処理失敗 (アイテム ${index}, 試行 ${attempt + 1}/${this.config.retryAttempts + 1}):`, {
          error: lastError.message
        });

        // 最後の試行でなければ指数バックオフ
        if (attempt < this.config.retryAttempts) {
          const delay = this.config.backoffDelay * Math.pow(2, attempt);
          console.log(`⏳ ${delay}ms 待機後リトライ...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { 
      success: false, 
      error: lastError?.message || 'Unknown error after all retry attempts' 
    };
  }

  /**
   * 📝 単一レビュー生成の実装
   */
  private async generateSingleReview(
    request: ReviewGenerationRequest, 
    anthropicApiKey: string
  ): Promise<GeneratedReview> {
    const { csvConfig, customPrompt, seed, index } = request;
    
    try {
      // ランダムペルソナ選択（シード値で制御して再現性確保）
      const patternIndex = Math.floor((seed + index) * csvConfig.humanPatterns.length) % csvConfig.humanPatterns.length;
      const randomPattern = csvConfig.humanPatterns[patternIndex];
      
      // 動的プロンプト生成
      const promptResult = this.buildDynamicPrompt(csvConfig, randomPattern, customPrompt);
      
      // Claude API呼び出し
      const reviewText = await this.callClaudeAPI(promptResult.dynamicPrompt, anthropicApiKey);
      
      // 品質スコア計算
      const qualityScore = this.calculateQualityScore(reviewText, csvConfig, randomPattern);
      
      // レビューオブジェクト構築
      const review: GeneratedReview = {
        reviewText: reviewText.trim(),
        rating: Math.floor(Math.random() * 2) + 4, // 4-5点
        reviewerAge: parseInt(randomPattern.age_group?.replace('代', '') || '20'),
        reviewerGender: (Math.random() > 0.5 ? 'male' : 'female') as 'male' | 'female' | 'other',
        qualityScore: qualityScore / 10, // 0-1スケールに正規化
        generationParameters: {
          selectedPattern: randomPattern,
          seed,
          index,
          usedWords: promptResult.usedWords || [],
          selectedRecommendation: promptResult.selectedRecommendation || ''
        },
        csvFileIds: [],
        createdAt: new Date().toISOString(),
        isApproved: qualityScore >= 7.0
      };

      return review;
      
    } catch (error) {
      console.error(`❌ レビュー生成エラー (index: ${index}):`, error);
      throw error;
    }
  }

  /**
   * 🎯 動的プロンプト生成
   */
  private buildDynamicPrompt(
    csvConfig: CSVConfig, 
    pattern: any, 
    customPrompt?: string
  ): { 
    dynamicPrompt: string; 
    usedWords: string[]; 
    selectedRecommendation: string; 
  } {
    const { basicRules } = csvConfig;
    
    // 基本要素を抽出
    const areas = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || ['池袋西口'];
    const businessTypes = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || ['SHOGUN BAR'];
    const usps = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')?.map(rule => rule.content) || ['日本酒'];
    const environments = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')?.map(rule => rule.content) || ['アクセス抜群'];
    const recommendations = basicRules?.filter(rule => rule.category === 'recommendation_phrases')?.map(rule => rule.content) || ['日本酒好きに'];
    
    // ランダム選択
    const selectedArea = areas[Math.floor(Math.random() * areas.length)];
    const selectedBusinessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
    const selectedUSP = usps[Math.floor(Math.random() * usps.length)];
    const selectedEnvironment = environments[Math.floor(Math.random() * environments.length)];
    const selectedRecommendation = recommendations[Math.floor(Math.random() * recommendations.length)];
    
    const usedWords = [selectedArea, selectedBusinessType, selectedUSP, selectedEnvironment];
    
    // 文字数重み付け（短文重視）
    const lengthWeights = [
      { range: '150-200', weight: 40 },
      { range: '201-250', weight: 30 },
      { range: '251-300', weight: 20 },
      { range: '301-400', weight: 10 }
    ];
    
    const randomWeight = Math.random() * 100;
    let selectedRange = '150-200';
    let cumulativeWeight = 0;
    
    for (const weight of lengthWeights) {
      cumulativeWeight += weight.weight;
      if (randomWeight <= cumulativeWeight) {
        selectedRange = weight.range;
        break;
      }
    }
    
    const dynamicPrompt = `
# 最適化Google口コミ生成

以下の条件で自然で魅力的なGoogle口コミを生成してください：

## 必須要素
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
- 特徴: ${selectedUSP}
- 環境: ${selectedEnvironment}
- 推奨: ${selectedRecommendation}

## ペルソナ
- 年代: ${pattern.age_group}
- 性格: ${pattern.personality_type}

## 要件
- 文字数: ${selectedRange}文字
- 自然で人間らしい表現
- 絵文字は一切使用しない
- 体験談として記述
- 文末に推奨フレーズを含める
- 非現実的内容（日本刀・武術等）は禁止

${customPrompt ? `\n## 追加指示\n${customPrompt}` : ''}

自然で魅力的なGoogle口コミを生成してください。
`;

    return {
      dynamicPrompt,
      usedWords,
      selectedRecommendation
    };
  }

  /**
   * 🤖 Claude API呼び出し（最適化版）
   */
  private async callClaudeAPI(prompt: string, apiKey: string): Promise<string> {
    try {
      const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.9,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API Error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const responseData = await response.json();
      
      if (responseData.content && responseData.content[0] && responseData.content[0].text) {
        let generatedText = responseData.content[0].text.trim();
        
        // 余計な説明文・注釈を除去
        generatedText = generatedText.replace(/\n\nNote:[\s\S]*$/i, '');
        generatedText = generatedText.replace(/\n注意:[\s\S]*$/i, '');
        generatedText = generatedText.replace(/\n備考:[\s\S]*$/i, '');
        generatedText = generatedText.replace(/※補足[\s\S]*$/i, '');
        generatedText = generatedText.replace(/（文字数：[\s\S]*$/i, '');
        generatedText = generatedText.replace(/^["「]|["」]$/g, '');
        
        return generatedText.trim();
      } else {
        throw new Error('Claude APIからの応答形式が予期しないものでした');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Claude APIリクエストがタイムアウトしました（${this.config.timeoutMs}ms）`);
      }
      throw new Error(`Claude APIリクエストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 📊 品質スコア計算
   */
  private calculateQualityScore(text: string, csvConfig: CSVConfig, pattern: any): number {
    let score = 10.0; // 基本スコア
    
    try {
      // 文字数チェック
      const length = text.length;
      if (length < 150 || length > 400) {
        score -= 2.0;
      }
      
      // 絵文字チェック（簡易版）
      const commonEmojis = ['😊', '😄', '😃', '😀', '🎉', '✨', '👍', '❤️', '💕', '🔥', '⭐', '🌟'];
      let hasEmoji = false;
      for (const emoji of commonEmojis) {
        if (text.includes(emoji)) {
          hasEmoji = true;
          break;
        }
      }
      
      if (hasEmoji) {
        score -= 3.0;
      }
      
      // 非現実的内容チェック
      const unrealisticPatterns = /日本刀|抜刀術|武術|侍のコスプレ|忍者|武士/g;
      if (unrealisticPatterns.test(text)) {
        score -= 5.0;
      }
      
      // 自然さチェック（簡易版）
      const unnaturalPatterns = /絶対|確実|必ず|100%|最高|最強|世界一|日本一/g;
      const unnaturalMatches = text.match(unnaturalPatterns);
      if (unnaturalMatches) {
        score -= unnaturalMatches.length * 1.0;
      }
      
      // 体験談らしさチェック
      const experiencePatterns = /行きました|食べました|飲みました|感じました|思いました|でした/g;
      const experienceMatches = text.match(experiencePatterns);
      if (!experienceMatches || experienceMatches.length < 2) {
        score -= 1.0;
      }
      
      return Math.max(0, Math.min(10, score));
    } catch (error) {
      console.error('❌ 品質スコア計算エラー:', error);
      return 5.0; // デフォルトスコア
    }
  }

  // ========================================
  // 🛠️ ユーティリティメソッド
  // ========================================

  /**
   * 配列をチャンクに分割
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * タイムアウトPromise生成
   */
  private createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 バッチ処理設定更新:', this.config);
  }

  /**
   * 統計情報取得
   */
  getStatistics(): {
    config: BatchProcessingConfig;
    rateLimiterStatus: any;
    circuitBreakerStatus: any;
  } {
    return {
      config: this.config,
      rateLimiterStatus: this.rateLimiter.getStatus(),
      circuitBreakerStatus: this.circuitBreaker.getStatus()
    };
  }
}

/**
 * 🚦 レート制限クラス
 */
class RateLimiter {
  private requests: number[] = [];
  private limit: number;

  constructor(requestsPerSecond: number) {
    this.limit = requestsPerSecond;
    console.log(`🚦 レート制限初期化: ${requestsPerSecond}req/sec`);
  }

  async wait(): Promise<void> {
    const now = Date.now();
    
    // 1秒以内のリクエストをフィルタ
    this.requests = this.requests.filter(time => now - time < 1000);
    
    if (this.requests.length >= this.limit) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 1000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`🚦 レート制限: ${waitTime}ms 待機`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.requests.push(now);
  }

  getStatus(): { currentRequests: number; limit: number; nextResetTime: number } {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 1000);
    
    return {
      currentRequests: this.requests.length,
      limit: this.limit,
      nextResetTime: this.requests.length > 0 ? Math.min(...this.requests) + 1000 : now
    };
  }
}

/**
 * ⚡ サーキットブレーカークラス
 */
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureThreshold: number;
  private resetTimeout: number;

  constructor(options: { failureThreshold: number; resetTimeout: number }) {
    this.failureThreshold = options.failureThreshold;
    this.resetTimeout = options.resetTimeout;
    console.log(`⚡ サーキットブレーカー初期化:`, options);
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        console.log('⚡ サーキットブレーカー: HALF_OPEN状態に移行');
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log('⚡ サーキットブレーカー: CLOSED状態に復旧');
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold && this.state === 'CLOSED') {
      console.warn(`⚡ サーキットブレーカー: OPEN状態に移行 (失敗数: ${this.failureCount})`);
      this.state = 'OPEN';
    }
  }

  getStatus(): {
    state: string;
    failureCount: number;
    failureThreshold: number;
    lastFailureTime: number;
    resetTimeout: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      resetTimeout: this.resetTimeout
    };
  }
}

export { OptimizedBatchProcessor, RateLimiter, CircuitBreaker };
export type { BatchProcessingConfig, BatchResult, ReviewGenerationRequest }; 