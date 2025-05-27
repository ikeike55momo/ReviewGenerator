/**
 * @file generate-reviews-optimized.ts
 * @description 最適化されたレビュー生成APIエンドポイント
 * OptimizedBatchProcessorを使用した高性能・高可用性レビュー生成システム
 * 並列処理、エラー回復、レート制限を含む包括的なパフォーマンス最適化
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';
import { OptimizedBatchProcessor } from '../../utils/OptimizedBatchProcessor';
import type { BatchProcessingConfig, BatchResult } from '../../utils/OptimizedBatchProcessor';

export const config = {
  maxDuration: 300, // 5分
};

/**
 * 最適化レビュー生成リクエストの型定義
 */
interface OptimizedReviewRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  batchConfig?: Partial<BatchProcessingConfig>;
  enableQualityFilter?: boolean;
  qualityThreshold?: number;
}

/**
 * 最適化レビュー生成レスポンスの型定義
 */
interface OptimizedReviewResponse {
  success: boolean;
  reviews: GeneratedReview[];
  batchResult: BatchResult<GeneratedReview>;
  performance: {
    totalProcessingTime: number;
    averageProcessingTime: number;
    successRate: number;
    throughput: number; // reviews per second
  };
  systemStatus: {
    rateLimiterStatus: any;
    circuitBreakerStatus: any;
    memoryUsage?: any;
  };
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<OptimizedReviewResponse>) {
  console.log('🚀 最適化レビュー生成API呼び出し開始');

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      reviews: [],
      batchResult: {
        success: [],
        failed: [],
        statistics: {
          totalProcessed: 0,
          successRate: 0,
          averageProcessingTime: 0,
          totalProcessingTime: 0
        }
      },
      performance: {
        totalProcessingTime: 0,
        averageProcessingTime: 0,
        successRate: 0,
        throughput: 0
      },
      systemStatus: {
        rateLimiterStatus: null,
        circuitBreakerStatus: null
      },
      error: 'Method not allowed'
    });
  }

  const startTime = Date.now();

  try {
    const { 
      csvConfig, 
      reviewCount, 
      customPrompt,
      batchConfig = {},
      enableQualityFilter = true,
      qualityThreshold = 0.7
    }: OptimizedReviewRequest = req.body;

    // 入力バリデーション
    if (!csvConfig || !reviewCount) {
      return res.status(400).json({
        success: false,
        reviews: [],
        batchResult: {
          success: [],
          failed: [],
          statistics: {
            totalProcessed: 0,
            successRate: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
          }
        },
        performance: {
          totalProcessingTime: 0,
          averageProcessingTime: 0,
          successRate: 0,
          throughput: 0
        },
        systemStatus: {
          rateLimiterStatus: null,
          circuitBreakerStatus: null
        },
        error: 'csvConfigとreviewCountは必須です'
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({
        success: false,
        reviews: [],
        batchResult: {
          success: [],
          failed: [],
          statistics: {
            totalProcessed: 0,
            successRate: 0,
            averageProcessingTime: 0,
            totalProcessingTime: 0
          }
        },
        performance: {
          totalProcessingTime: 0,
          averageProcessingTime: 0,
          successRate: 0,
          throughput: 0
        },
        systemStatus: {
          rateLimiterStatus: null,
          circuitBreakerStatus: null
        },
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    // レビュー数制限
    const maxReviews = 100;
    const actualReviewCount = Math.min(reviewCount, maxReviews);
    
    if (reviewCount > maxReviews) {
      console.warn(`⚠️ レビュー数制限: ${reviewCount} → ${maxReviews}`);
    }

    console.log('🚀 最適化レビュー生成開始:', { 
      reviewCount: actualReviewCount,
      batchConfig,
      enableQualityFilter,
      qualityThreshold 
    });

    // 最適化バッチプロセッサーの初期化
    const optimizedBatchConfig: Partial<BatchProcessingConfig> = {
      concurrency: 3, // Netlify制限考慮
      retryAttempts: 2,
      backoffDelay: 1000,
      timeoutMs: 45000,
      rateLimitPerSecond: 8, // 保守的な設定
      ...batchConfig
    };

    const batchProcessor = new OptimizedBatchProcessor(optimizedBatchConfig);

    // バッチ処理実行
    const batchResult = await batchProcessor.generateReviewsBatch(
      csvConfig,
      actualReviewCount,
      anthropicApiKey,
      customPrompt
    );

    // 品質フィルタリング
    let filteredReviews = batchResult.success;
    if (enableQualityFilter) {
      const beforeCount = filteredReviews.length;
      filteredReviews = filteredReviews.filter(review => 
        review.qualityScore >= qualityThreshold
      );
      const afterCount = filteredReviews.length;
      
      if (beforeCount > afterCount) {
        console.log(`🔍 品質フィルタリング: ${beforeCount} → ${afterCount} (${afterCount/beforeCount*100}%)`);
      }
    }

    // パフォーマンス統計計算
    const endTime = Date.now();
    const totalProcessingTime = endTime - startTime;
    const throughput = filteredReviews.length / (totalProcessingTime / 1000);

    const performance = {
      totalProcessingTime,
      averageProcessingTime: batchResult.statistics.averageProcessingTime,
      successRate: batchResult.statistics.successRate,
      throughput
    };

    // システム状態取得
    const systemStatus = {
      rateLimiterStatus: batchProcessor.getStatistics().rateLimiterStatus,
      circuitBreakerStatus: batchProcessor.getStatistics().circuitBreakerStatus,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : undefined
    };

    console.log('✅ 最適化レビュー生成完了:', {
      生成数: filteredReviews.length,
      成功率: `${(performance.successRate * 100).toFixed(1)}%`,
      スループット: `${throughput.toFixed(2)} reviews/sec`,
      総処理時間: `${totalProcessingTime}ms`
    });

    return res.status(200).json({
      success: true,
      reviews: filteredReviews,
      batchResult,
      performance,
      systemStatus
    });

  } catch (error) {
    const endTime = Date.now();
    const totalProcessingTime = endTime - startTime;
    
    console.error('❌ 最適化レビュー生成エラー:', error);
    
    return res.status(500).json({
      success: false,
      reviews: [],
      batchResult: {
        success: [],
        failed: [{
          index: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          input: null
        }],
        statistics: {
          totalProcessed: 0,
          successRate: 0,
          averageProcessingTime: 0,
          totalProcessingTime
        }
      },
      performance: {
        totalProcessingTime,
        averageProcessingTime: 0,
        successRate: 0,
        throughput: 0
      },
      systemStatus: {
        rateLimiterStatus: null,
        circuitBreakerStatus: null,
        memoryUsage: process.memoryUsage ? process.memoryUsage() : undefined
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 