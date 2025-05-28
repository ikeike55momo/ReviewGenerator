/**
 * @file EnhancedQAProhibitionController.ts
 * @description 強化されたQA禁止事項制御システム
 * 部分一致、類似表現、パターンマッチングを組み合わせた高精度検出
 * QAナレッジ禁止事項制御の主要な問題点を解決する包括的システム
 */

/**
 * 強化されたQA違反情報の型定義
 */
interface EnhancedQAViolation {
  type: string;
  description: string;
  severity: '致命的' | '高' | '中' | '低';
  confidence: number; // 信頼度 0-1
  relatedQA: string;
  detectionMethod: 'exact' | 'partial' | 'regex' | 'semantic';
  suggestedFix?: string;
}

/**
 * 禁止ルールの型定義
 */
interface ProhibitionRule {
  id: string;
  pattern: string | RegExp;
  type: 'exact' | 'partial' | 'regex' | 'semantic';
  severity: '致命的' | '高' | '中' | '低';
  category: string;
  description: string;
  alternatives?: string[];
  contextRequired?: string[];
}

/**
 * 🛡️ 強化されたQA禁止事項制御システム
 * 従来の単純な文字列マッチングを超えた高度な違反検出システム
 */
class EnhancedQAProhibitionController {
  private prohibitionRules: ProhibitionRule[] = [];
  private semanticCache: Map<string, number> = new Map();
  private readonly MAX_CACHE_SIZE = 1000; // キャッシュサイズ制限
  private cacheAccessOrder: string[] = []; // LRU実装用

  constructor() {
    console.log('🛡️ 強化されたQA禁止事項制御システム初期化');
  }

  /**
   * 🔍 QAナレッジから動的に禁止ルールを生成
   * 完全一致・部分一致・パターンマッチングの3層構造
   */
  generateProhibitionRules(qaKnowledge: any[]): ProhibitionRule[] {
    console.log('🔍 禁止ルール動的生成開始...', { qaCount: qaKnowledge.length });
    
    const rules: ProhibitionRule[] = [];
    
    qaKnowledge.forEach((qa, index) => {
      if (qa.example_before) {
        // 1. 完全一致ルール（最高精度）
        rules.push({
          id: `exact_${index}`,
          pattern: qa.example_before,
          type: 'exact',
          severity: this.mapPriorityToSeverity(qa.priority),
          category: qa.category || 'general',
          description: qa.question,
          alternatives: qa.example_after ? [qa.example_after] : []
        });

        // 2. 部分一致ルール（キーワード抽出）
        const keywords = this.extractKeywords(qa.example_before);
        keywords.forEach(keyword => {
          if (keyword.length > 2) { // 短すぎるキーワードを除外
            rules.push({
              id: `partial_${index}_${keyword}`,
              pattern: keyword,
              type: 'partial',
              severity: this.degradeSeverity(this.mapPriorityToSeverity(qa.priority)),
              category: qa.category || 'general',
              description: `${qa.question} - キーワード: ${keyword}`,
              contextRequired: [qa.example_before]
            });
          }
        });

        // 3. パターンマッチングルール（正規表現）
        const patterns = this.generatePatterns(qa.example_before, qa.category);
        patterns.forEach((pattern, i) => {
          rules.push({
            id: `pattern_${index}_${i}`,
            pattern: pattern,
            type: 'regex',
            severity: this.degradeSeverity(this.mapPriorityToSeverity(qa.priority)),
            category: qa.category || 'general',
            description: `${qa.question} - パターン違反`
          });
        });
      }
    });

    this.prohibitionRules = rules;
    console.log('✅ 禁止ルール生成完了:', {
      総ルール数: rules.length,
      完全一致: rules.filter(r => r.type === 'exact').length,
      部分一致: rules.filter(r => r.type === 'partial').length,
      パターン: rules.filter(r => r.type === 'regex').length
    });
    
    return rules;
  }

  /**
   * 🔍 強化された違反検出（多層検出システム）
   */
  async detectViolations(reviewText: string, qaKnowledge: any[]): Promise<EnhancedQAViolation[]> {
    console.log('🔍 強化された違反検出開始...', { textLength: reviewText.length });
    
    const violations: EnhancedQAViolation[] = [];
    
    try {
      // 1. ルールベース検出（高速・高精度）
      for (const rule of this.prohibitionRules) {
        const violation = await this.checkRule(reviewText, rule);
        if (violation) {
          violations.push(violation);
        }
      }

      // 2. セマンティック類似度検出（AI駆動）
      const semanticViolations = await this.detectSemanticViolations(reviewText, qaKnowledge);
      violations.push(...semanticViolations);

      // 3. コンテキスト分析（文脈考慮）
      const contextViolations = await this.detectContextualViolations(reviewText, qaKnowledge);
      violations.push(...contextViolations);

      // 4. 重複除去と優先度付け
      const finalViolations = this.deduplicateAndPrioritize(violations);
      
      console.log('✅ 違反検出完了:', {
        検出数: finalViolations.length,
        致命的: finalViolations.filter(v => v.severity === '致命的').length,
        高: finalViolations.filter(v => v.severity === '高').length,
        中: finalViolations.filter(v => v.severity === '中').length,
        低: finalViolations.filter(v => v.severity === '低').length
      });
      
      return finalViolations;
    } catch (error) {
      console.error('❌ 違反検出エラー:', error);
      return [];
    }
  }

  /**
   * 🔍 ルールチェック（個別ルール検証）
   */
  private async checkRule(text: string, rule: ProhibitionRule): Promise<EnhancedQAViolation | null> {
    let isMatch = false;
    let confidence = 0;

    try {
      switch (rule.type) {
        case 'exact':
          isMatch = text.includes(rule.pattern as string);
          confidence = isMatch ? 1.0 : 0;
          break;
          
        case 'partial':
          const partialMatches = this.findPartialMatches(text, rule.pattern as string);
          isMatch = partialMatches.length > 0;
          confidence = Math.min(partialMatches.length * 0.3, 0.9);
          break;
          
        case 'regex':
          const regex = rule.pattern as RegExp;
          isMatch = regex.test(text);
          confidence = isMatch ? 0.8 : 0;
          break;
          
        case 'semantic':
          confidence = await this.calculateSemanticSimilarity(text, rule.pattern as string);
          isMatch = confidence > 0.7;
          break;
      }

      if (isMatch && confidence > 0.5) {
        return {
          type: `${rule.category}_violation`,
          description: rule.description,
          severity: rule.severity,
          confidence,
          relatedQA: rule.id,
          detectionMethod: rule.type,
          suggestedFix: rule.alternatives?.[0]
        };
      }
    } catch (error) {
      console.error('❌ ルールチェックエラー:', { ruleId: rule.id, error });
    }

    return null;
  }

  /**
   * 🤖 セマンティック類似度による違反検出
   */
  private async detectSemanticViolations(
    reviewText: string, 
    qaKnowledge: any[]
  ): Promise<EnhancedQAViolation[]> {
    const violations: EnhancedQAViolation[] = [];
    
    try {
      for (const qa of qaKnowledge) {
        if (qa.example_before && qa.priority === 'Critical') {
          const similarity = await this.calculateSemanticSimilarity(reviewText, qa.example_before);
          
          if (similarity > 0.75) { // 高い類似度
            violations.push({
              type: 'semantic_violation',
              description: `${qa.question} - 類似表現検出`,
              severity: '高',
              confidence: similarity,
              relatedQA: qa.question,
              detectionMethod: 'semantic',
              suggestedFix: qa.example_after
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ セマンティック違反検出エラー:', error);
    }
    
    return violations;
  }

  /**
   * 📝 コンテキスト分析による違反検出
   */
  private async detectContextualViolations(
    reviewText: string, 
    qaKnowledge: any[]
  ): Promise<EnhancedQAViolation[]> {
    const violations: EnhancedQAViolation[] = [];
    
    try {
      // 文脈を考慮した違反検出
      for (const qa of qaKnowledge) {
        if (qa.category === '文脈依存' && qa.example_situation) {
          const contextMatch = this.analyzeContext(reviewText, qa.example_situation);
          
          if (contextMatch.isMatch && contextMatch.confidence > 0.6) {
            violations.push({
              type: 'contextual_violation',
              description: `${qa.question} - 文脈違反`,
              severity: this.mapPriorityToSeverity(qa.priority),
              confidence: contextMatch.confidence,
              relatedQA: qa.question,
                             detectionMethod: 'regex'
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ コンテキスト違反検出エラー:', error);
    }
    
    return violations;
  }

  /**
   * 📊 階層的禁止事項管理
   */
  createHierarchicalRules(qaKnowledge: any[]): {
    critical: ProhibitionRule[];
    high: ProhibitionRule[];
    medium: ProhibitionRule[];
    low: ProhibitionRule[];
  } {
    const hierarchy = {
      critical: [] as ProhibitionRule[],
      high: [] as ProhibitionRule[],
      medium: [] as ProhibitionRule[],
      low: [] as ProhibitionRule[]
    };

    this.prohibitionRules.forEach(rule => {
      switch (rule.severity) {
        case '致命的':
          hierarchy.critical.push(rule);
          break;
        case '高':
          hierarchy.high.push(rule);
          break;
        case '中':
          hierarchy.medium.push(rule);
          break;
        case '低':
          hierarchy.low.push(rule);
          break;
      }
    });

    console.log('📊 階層的ルール分類完了:', {
      致命的: hierarchy.critical.length,
      高: hierarchy.high.length,
      中: hierarchy.medium.length,
      低: hierarchy.low.length
    });

    return hierarchy;
  }

  // ========================================
  // 🛠️ ユーティリティメソッド
  // ========================================

  /**
   * 優先度から重要度へのマッピング
   */
  private mapPriorityToSeverity(priority: string): '致命的' | '高' | '中' | '低' {
    switch (priority) {
      case 'Critical': return '致命的';
      case 'High': return '高';
      case 'Medium': return '中';
      default: return '低';
    }
  }

  /**
   * 重要度の段階的降格
   */
  private degradeSeverity(severity: '致命的' | '高' | '中' | '低'): '致命的' | '高' | '中' | '低' {
    switch (severity) {
      case '致命的': return '高';
      case '高': return '中';
      case '中': return '低';
      default: return '低';
    }
  }

  /**
   * キーワード抽出（形態素解析風）
   */
  private extractKeywords(text: string): string[] {
    // 日本語テキストから重要語を抽出
    const words = text.split(/[\s、。！？]/);
    return words
      .filter(word => word.length > 1)
      .filter(word => !/^[ぁ-ん]+$/.test(word)) // ひらがなのみを除外
      .filter(word => word.length <= 10); // 長すぎる語を除外
  }

  /**
   * カテゴリ別パターン生成
   */
  private generatePatterns(text: string, category: string): RegExp[] {
    const patterns: RegExp[] = [];
    
    try {
      // カテゴリ別パターン生成
      switch (category) {
        case '表現問題':
          patterns.push(/(.{1,3})\1{3,}/g); // 同じ文字の繰り返し
          patterns.push(/[！]{3,}/g); // 感嘆符の過度な使用
          patterns.push(/[。]{2,}/g); // 句点の連続
          break;
          
        case '内容問題':
          patterns.push(/絶対|確実|必ず|100%/g); // 断定的表現
          patterns.push(/最高|最強|世界一|日本一/g); // 誇張表現
          break;
          
        case '限定的シチュエーション':
          patterns.push(/\d+歳の誕生日|結婚記念日|昇進祝い/g); // 個人的すぎる状況
          break;
          
        case '非現実的内容':
          patterns.push(/日本刀|抜刀術|武術|侍のコスプレ/g); // 非現実的要素
          break;
      }
    } catch (error) {
      console.error('❌ パターン生成エラー:', { category, error });
    }
    
    return patterns;
  }

  /**
   * 部分一致検出
   */
  private findPartialMatches(text: string, pattern: string): string[] {
    const matches: string[] = [];
    const words = pattern.split(/\s+/);
    
    words.forEach(word => {
      if (word.length > 1 && text.includes(word)) {
        matches.push(word);
      }
    });
    
    return matches;
  }

  /**
   * セマンティック類似度計算（LRUキャッシュ付き）
   */
  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    // キャッシュキー生成
    const key = `${text1.substring(0, 50)}_${text2.substring(0, 50)}`;
    
    // キャッシュヒット時の処理
    if (this.semanticCache.has(key)) {
      // LRU: アクセス順序を更新
      this.updateCacheAccessOrder(key);
      return this.semanticCache.get(key)!;
    }

    try {
      // 簡易的な類似度計算（実際の実装ではベクトル化や機械学習モデルを使用）
      const similarity = this.calculateJaccardSimilarity(text1, text2);
      
      // キャッシュに追加（LRU管理付き）
      this.addToCache(key, similarity);
      
      return similarity;
    } catch (error) {
      console.error('❌ セマンティック類似度計算エラー:', error);
      return 0;
    }
  }

  /**
   * LRUキャッシュにアイテムを追加
   */
  private addToCache(key: string, value: number): void {
    // キャッシュサイズ制限チェック
    if (this.semanticCache.size >= this.MAX_CACHE_SIZE) {
      // 最も古いアイテムを削除（LRU）
      const oldestKey = this.cacheAccessOrder.shift();
      if (oldestKey) {
        this.semanticCache.delete(oldestKey);
      }
    }

    // 新しいアイテムを追加
    this.semanticCache.set(key, value);
    this.cacheAccessOrder.push(key);
  }

  /**
   * キャッシュアクセス順序を更新（LRU）
   */
  private updateCacheAccessOrder(key: string): void {
    // 既存のエントリを削除
    const index = this.cacheAccessOrder.indexOf(key);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    
    // 最新として追加
    this.cacheAccessOrder.push(key);
  }

  /**
   * キャッシュをクリア
   */
  private clearCache(): void {
    this.semanticCache.clear();
    this.cacheAccessOrder = [];
  }

  /**
   * Jaccard類似度計算
   */
  private calculateJaccardSimilarity(text1: string, text2: string): number {
    try {
      const set1 = new Set(text1.split(''));
      const set2 = new Set(text2.split(''));
      
      const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
      const union = new Set([...Array.from(set1), ...Array.from(set2)]);
      
      return union.size > 0 ? intersection.size / union.size : 0;
    } catch (error) {
      console.error('❌ Jaccard類似度計算エラー:', error);
      return 0;
    }
  }

  /**
   * 文脈分析
   */
  private analyzeContext(text: string, situationPattern: string): { isMatch: boolean; confidence: number } {
    try {
      // 文脈分析のロジック
      const contextKeywords = situationPattern.split(/[\s、。]/);
      let matchCount = 0;
      
      contextKeywords.forEach(keyword => {
        if (keyword.length > 1 && text.includes(keyword)) {
          matchCount++;
        }
      });
      
      const confidence = contextKeywords.length > 0 ? matchCount / contextKeywords.length : 0;
      return {
        isMatch: confidence > 0.5,
        confidence
      };
    } catch (error) {
      console.error('❌ 文脈分析エラー:', error);
      return { isMatch: false, confidence: 0 };
    }
  }

  /**
   * 重複除去と優先度付け
   */
  private deduplicateAndPrioritize(violations: EnhancedQAViolation[]): EnhancedQAViolation[] {
    try {
      // 重複除去
      const uniqueViolations = violations.filter((violation, index, self) => 
        index === self.findIndex(v => v.type === violation.type && v.description === violation.description)
      );

      // 重要度と信頼度でソート
      return uniqueViolations.sort((a, b) => {
        const severityOrder = { '致命的': 4, '高': 3, '中': 2, '低': 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        
        if (severityDiff !== 0) return severityDiff;
        return b.confidence - a.confidence;
      });
    } catch (error) {
      console.error('❌ 重複除去・優先度付けエラー:', error);
      return violations;
    }
  }

  /**
   * 統計情報取得
   */
  getStatistics(): {
    totalRules: number;
    rulesByType: Record<string, number>;
    rulesBySeverity: Record<string, number>;
    cacheSize: number;
  } {
    const rulesByType = this.prohibitionRules.reduce((acc, rule) => {
      acc[rule.type] = (acc[rule.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const rulesBySeverity = this.prohibitionRules.reduce((acc, rule) => {
      acc[rule.severity] = (acc[rule.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRules: this.prohibitionRules.length,
      rulesByType,
      rulesBySeverity,
      cacheSize: this.semanticCache.size
    };
  }
}

export { EnhancedQAProhibitionController };
export type { EnhancedQAViolation, ProhibitionRule }; 