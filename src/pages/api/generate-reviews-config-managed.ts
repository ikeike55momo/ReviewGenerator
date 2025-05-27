/**
 * @file generate-reviews-config-managed.ts
 * @description 設定管理システム統合レビュー生成API
 * 主な機能：外部設定活用、動的設定更新、運用監視統合
 * 制限事項：設定値のハードコーディング排除、リアルタイム設定反映
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { ConfigurationManager, OperationalMonitor, SystemConfiguration } from '../../utils/ConfigurationManager';
import { TypeSafeQAKnowledgeAgent, Result, QAKnowledgeEntry } from '../../utils/TypeSafeQAKnowledgeAgent';

// ========================================
// 型定義
// ========================================

interface ConfigManagedRequest {
  csvConfig: CSVConfig;
  reviewCount?: number;
  customPrompt?: string;
  enableQualityCheck?: boolean;
  qualityThreshold?: number;
  enableStrictValidation?: boolean;
  overrideConfig?: Partial<SystemConfiguration>;
}

interface ConfigManagedResponse {
  success: boolean;
  reviews: GeneratedReview[];
  count: number;
  statistics: DetailedStatistics;
  qualityAnalysis?: QualityAnalysis;
  configurationStatus: ConfigurationStatus;
  systemHealth: SystemHealth;
  error?: StructuredError;
}

interface ConfigurationStatus {
  isValid: boolean;
  activeConfig: ConfigSummary;
  lastUpdated: string;
  source: 'default' | 'environment' | 'file' | 'override';
  warnings: string[];
}

interface ConfigSummary {
  apiModel: string;
  qualityThreshold: number;
  batchConcurrency: number;
  enableMonitoring: boolean;
  logLevel: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthCheckResult>;
  metrics: Record<string, number>;
  alerts: AlertSummary[];
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  message: string;
  lastChecked: string;
}

interface AlertSummary {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface CSVConfig {
  humanPatterns: Array<{ age_group: string; personality_type: string }>;
  basicRules: Array<{ category: string; type: string; content: string }>;
  qaKnowledge?: Array<{
    question: string;
    answer: string;
    category: string;
    priority: string;
    example_before?: string;
    example_after?: string;
  }>;
}

interface GeneratedReview {
  reviewText: string;
  qualityScore: number;
  generationParameters: {
    selectedAge: string;
    selectedPersonality: string;
    selectedArea: string;
    selectedBusinessType: string;
    selectedUSP: string;
    mode: string;
  };
  qualityCheck?: {
    passed: boolean;
    violations: Array<{
      type: string;
      description: string;
      severity: string;
      confidence: number;
    }>;
    recommendations: string[];
  };
}

interface DetailedStatistics {
  totalProcessingTime: number;
  averageQualityScore: number;
  passedQualityCheck: number;
  failedQualityCheck: number;
  validationErrors: number;
  configurationOverrides: number;
}

interface QualityAnalysis {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  commonViolations: string[];
}

interface StructuredError {
  code: string;
  message: string;
  category: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

// ========================================
// メイン処理
// ========================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConfigManagedResponse>
) {
  // 設定管理システムの初期化
  const configManager = ConfigurationManager.getInstance();
  const monitor = new OperationalMonitor(configManager);
  
  const startTime = Date.now();
  
  try {
    // リクエスト検証
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        reviews: [],
        count: 0,
        statistics: createEmptyStatistics(),
        configurationStatus: await getConfigurationStatus(configManager),
        systemHealth: await getSystemHealth(monitor),
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'POST method required',
          category: 'API',
          timestamp: new Date().toISOString()
        }
      });
    }

    const requestData: ConfigManagedRequest = req.body;
    
    // 設定オーバーライドの適用
    if (requestData.overrideConfig) {
      await applyConfigurationOverrides(configManager, requestData.overrideConfig);
    }

    // 設定の検証
    const configValidation = configManager.validate();
    if (!configValidation.isValid) {
      return res.status(400).json({
        success: false,
        reviews: [],
        count: 0,
        statistics: createEmptyStatistics(),
        configurationStatus: await getConfigurationStatus(configManager),
        systemHealth: await getSystemHealth(monitor),
        error: {
          code: 'CONFIGURATION_INVALID',
          message: `Configuration validation failed: ${configValidation.errors.join(', ')}`,
          category: 'VALIDATION',
          context: { errors: configValidation.errors, warnings: configValidation.warnings },
          timestamp: new Date().toISOString()
        }
      });
    }

    // システムヘルスチェック
    const healthStatus = await monitor.healthCheck();
    if (healthStatus.status === 'unhealthy') {
      return res.status(503).json({
        success: false,
        reviews: [],
        count: 0,
        statistics: createEmptyStatistics(),
        configurationStatus: await getConfigurationStatus(configManager),
        systemHealth: await getSystemHealth(monitor),
        error: {
          code: 'SYSTEM_UNHEALTHY',
          message: 'System health check failed',
          category: 'SYSTEM',
          context: { healthChecks: healthStatus.checks },
          timestamp: new Date().toISOString()
        }
      });
    }

    // 設定値の取得
    const apiConfig = configManager.get<any>('api');
    const qualityConfig = configManager.get<any>('quality');
    const processingConfig = configManager.get<any>('processing');
    
    const reviewCount = Math.min(
      requestData.reviewCount || processingConfig.generation.defaultReviewCount,
      processingConfig.generation.maxReviewCount
    );

    // メトリクス記録
    monitor.recordMetric('requests.total', 1);
    monitor.recordMetric('requests.review_count', reviewCount);

    // QAナレッジエージェントの初期化
    const qaAgent = new TypeSafeQAKnowledgeAgent();
    
    // レビュー生成処理
    const generatedReviews: GeneratedReview[] = [];
    const statistics: DetailedStatistics = {
      totalProcessingTime: 0,
      averageQualityScore: 0,
      passedQualityCheck: 0,
      failedQualityCheck: 0,
      validationErrors: 0,
      configurationOverrides: requestData.overrideConfig ? Object.keys(requestData.overrideConfig).length : 0
    };

    // バッチ処理設定
    const batchConfig = processingConfig.batch;
    const concurrency = Math.min(batchConfig.defaultConcurrency, batchConfig.maxConcurrency);
    
    // 並列処理でレビュー生成
    for (let i = 0; i < reviewCount; i += concurrency) {
      const batchSize = Math.min(concurrency, reviewCount - i);
      const batchPromises: Promise<GeneratedReview | null>[] = [];
      
      for (let j = 0; j < batchSize; j++) {
        batchPromises.push(generateSingleReview(
          requestData,
          apiConfig,
          qualityConfig,
          qaAgent,
          monitor,
          i + j
        ));
      }
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result) {
          generatedReviews.push(result);
          
          // 統計更新
          if (result.qualityCheck?.passed) {
            statistics.passedQualityCheck++;
          } else {
            statistics.failedQualityCheck++;
          }
        }
      }
      
      // レート制限遵守
      if (i + batchSize < reviewCount) {
        await new Promise(resolve => setTimeout(resolve, 1000 / apiConfig.claude.rateLimitPerSecond));
      }
    }

    // 統計計算
    statistics.totalProcessingTime = Date.now() - startTime;
    statistics.averageQualityScore = generatedReviews.length > 0 
      ? generatedReviews.reduce((sum, review) => sum + review.qualityScore, 0) / generatedReviews.length
      : 0;

    // 品質分析
    const qualityAnalysis = analyzeQuality(generatedReviews);

    // メトリクス記録
    monitor.recordMetric('generation.success_rate', generatedReviews.length / reviewCount);
    monitor.recordMetric('quality.average', statistics.averageQualityScore);
    monitor.recordMetric('processing.time_ms', statistics.totalProcessingTime);

    // レスポンス生成
    const response: ConfigManagedResponse = {
      success: true,
      reviews: generatedReviews,
      count: generatedReviews.length,
      statistics,
      qualityAnalysis,
      configurationStatus: await getConfigurationStatus(configManager),
      systemHealth: await getSystemHealth(monitor)
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('設定管理レビュー生成エラー:', error);
    
    // エラーメトリクス記録
    monitor.recordMetric('errors.total', 1);
    
    const errorResponse: ConfigManagedResponse = {
      success: false,
      reviews: [],
      count: 0,
      statistics: {
        ...createEmptyStatistics(),
        totalProcessingTime: Date.now() - startTime
      },
      configurationStatus: await getConfigurationStatus(configManager),
      systemHealth: await getSystemHealth(monitor),
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        category: 'SYSTEM',
        context: { originalError: String(error) },
        timestamp: new Date().toISOString()
      }
    };

    res.status(500).json(errorResponse);
  }
}

// ========================================
// ヘルパー関数
// ========================================

async function generateSingleReview(
  requestData: ConfigManagedRequest,
  apiConfig: any,
  qualityConfig: any,
  qaAgent: TypeSafeQAKnowledgeAgent,
  monitor: OperationalMonitor,
  index: number
): Promise<GeneratedReview | null> {
  try {
    // ペルソナ選択
    const humanPattern = requestData.csvConfig.humanPatterns[
      index % requestData.csvConfig.humanPatterns.length
    ];
    
    // 基本ルール選択
    const areaRule = requestData.csvConfig.basicRules.find(rule => rule.type === 'area');
    const businessRule = requestData.csvConfig.basicRules.find(rule => rule.type === 'business_type');
    const uspRule = requestData.csvConfig.basicRules.find(rule => rule.type === 'usp');

    // プロンプト生成
    const prompt = generatePrompt(
      humanPattern,
      areaRule?.content || '池袋西口',
      businessRule?.content || 'SHOGUN BAR',
      uspRule?.content || '日本酒',
      requestData.customPrompt
    );

    // Claude API呼び出し
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: apiConfig.claude.model,
        max_tokens: apiConfig.claude.maxTokens,
        temperature: apiConfig.claude.temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: AbortSignal.timeout(apiConfig.claude.timeoutMs)
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const reviewText = data.content[0].text;

         // 品質チェック
     let qualityCheck;
     if (requestData.enableQualityCheck && requestData.csvConfig.qaKnowledge) {
       const qaKnowledge = requestData.csvConfig.qaKnowledge.map(qa => ({
         ...qa,
         category: qa.category as any,
         priority: qa.priority as any
       })) as QAKnowledgeEntry[];
       
       const qaResult = await qaAgent.performQualityCheck(reviewText, qaKnowledge);
       if (qaResult.isSuccess()) {
         qualityCheck = {
           passed: qaResult.value.passed,
           violations: qaResult.value.violations.map(v => ({
             type: v.type,
             description: v.description,
             severity: v.severity,
             confidence: v.confidence
           })),
           recommendations: qaResult.value.recommendations
         };
       }
     }

    // 品質スコア計算
    const qualityScore = calculateQualityScore(reviewText, qualityCheck);

    return {
      reviewText,
      qualityScore,
      generationParameters: {
        selectedAge: humanPattern.age_group,
        selectedPersonality: humanPattern.personality_type,
        selectedArea: areaRule?.content || '池袋西口',
        selectedBusinessType: businessRule?.content || 'SHOGUN BAR',
        selectedUSP: uspRule?.content || '日本酒',
        mode: 'config-managed'
      },
      qualityCheck
    };

  } catch (error) {
    console.error(`レビュー生成エラー (index: ${index}):`, error);
    monitor.recordMetric('generation.errors', 1);
    return null;
  }
}

function generatePrompt(
  humanPattern: { age_group: string; personality_type: string },
  area: string,
  businessType: string,
  usp: string,
  customPrompt?: string
): string {
  if (customPrompt) {
    return customPrompt;
  }

  return `あなたは${humanPattern.age_group}の${humanPattern.personality_type}な人として、${area}にある${businessType}について、${usp}を体験した口コミレビューを150-400文字で書いてください。

重要な条件：
- 一人称視点で個人的な体験として記述
- 自然で説得力のある内容
- ${usp}について具体的に言及
- ${humanPattern.personality_type}な文体で表現

以下の要素を自然に含めてください：
- 場所: ${area}
- 店舗: ${businessType}
- 特徴: ${usp}`;
}

function calculateQualityScore(reviewText: string, qualityCheck?: any): number {
  let score = 8.0;
  
  // 文字数チェック
  if (reviewText.length < 150) score -= 1.0;
  if (reviewText.length > 400) score -= 0.5;
  
  // 品質チェック結果反映
  if (qualityCheck) {
    for (const violation of qualityCheck.violations) {
      switch (violation.severity) {
        case '致命的':
          score -= 3.0;
          break;
        case '高':
          score -= 2.0;
          break;
        case '中':
          score -= 1.0;
          break;
        case '低':
          score -= 0.5;
          break;
      }
    }
  }
  
  return Math.max(0, Math.min(10, score));
}

function analyzeQuality(reviews: GeneratedReview[]): QualityAnalysis {
  if (reviews.length === 0) {
    return {
      overallQuality: 'poor',
      recommendations: ['レビューが生成されませんでした'],
      commonViolations: []
    };
  }

  const averageScore = reviews.reduce((sum, review) => sum + review.qualityScore, 0) / reviews.length;
  
  let overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  if (averageScore >= 8.5) overallQuality = 'excellent';
  else if (averageScore >= 7.0) overallQuality = 'good';
  else if (averageScore >= 5.0) overallQuality = 'fair';
  else overallQuality = 'poor';

  const recommendations: string[] = [];
  const commonViolations: string[] = [];

  // 品質チェック結果の分析
  const allViolations = reviews
    .filter(review => review.qualityCheck)
    .flatMap(review => review.qualityCheck!.violations);

  const violationCounts = new Map<string, number>();
  for (const violation of allViolations) {
    violationCounts.set(violation.type, (violationCounts.get(violation.type) || 0) + 1);
  }

     // 一般的な違反の特定
   violationCounts.forEach((count, type) => {
     if (count >= reviews.length * 0.3) {
       commonViolations.push(type);
     }
   });

  // 推奨事項の生成
  if (averageScore < 7.0) {
    recommendations.push('品質向上のため、プロンプトの調整を検討してください');
  }
  if (commonViolations.length > 0) {
    recommendations.push('一般的な違反パターンの対策を強化してください');
  }

  return {
    overallQuality,
    recommendations,
    commonViolations
  };
}

async function applyConfigurationOverrides(
  configManager: ConfigurationManager,
  overrides: Partial<any>
): Promise<void> {
  for (const [path, value] of Object.entries(overrides)) {
    configManager.set(path, value);
  }
}

async function getConfigurationStatus(configManager: ConfigurationManager): Promise<ConfigurationStatus> {
  const validation = configManager.validate();
  
  return {
    isValid: validation.isValid,
    activeConfig: {
      apiModel: configManager.get<string>('api.claude.model'),
      qualityThreshold: configManager.get<number>('quality.thresholds.minimumScore'),
      batchConcurrency: configManager.get<number>('processing.batch.defaultConcurrency'),
      enableMonitoring: configManager.get<boolean>('monitoring.metrics.enableMetrics'),
      logLevel: configManager.get<string>('monitoring.logging.level')
    },
    lastUpdated: new Date().toISOString(),
    source: 'default', // 実際の実装では設定ソースを追跡
    warnings: validation.warnings
  };
}

async function getSystemHealth(monitor: OperationalMonitor): Promise<SystemHealth> {
  const healthStatus = await monitor.healthCheck();
  const metrics = monitor.getMetrics();
  const alerts = monitor.getAlerts();
  
  return {
    status: healthStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
    checks: Object.fromEntries(
      Object.entries(healthStatus.checks).map(([key, check]) => [
        key,
        {
          status: check.status,
          message: check.message,
          lastChecked: new Date().toISOString()
        }
      ])
    ),
    metrics,
    alerts: alerts.slice(-5).map(alert => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp
    }))
  };
}

function createEmptyStatistics(): DetailedStatistics {
  return {
    totalProcessingTime: 0,
    averageQualityScore: 0,
    passedQualityCheck: 0,
    failedQualityCheck: 0,
    validationErrors: 0,
    configurationOverrides: 0
  };
} 