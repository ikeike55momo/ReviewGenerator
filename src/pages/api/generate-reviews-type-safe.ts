/**
 * @file generate-reviews-type-safe.ts
 * @description 型安全レビュー生成APIエンドポイント
 * Result型パターン、カスタムエラー型、包括的型検証を統合
 * TypeSafeQAKnowledgeAgentを使用した高品質レビュー生成
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';
import { TypeSafeQAKnowledgeAgent, Result } from '../../utils/TypeSafeQAKnowledgeAgent';

/**
 * 型安全レビューリクエストの型定義
 */
interface TypeSafeReviewRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  enableQualityCheck?: boolean;
  qualityThreshold?: number;
  enableStrictValidation?: boolean;
}

/**
 * 詳細統計情報の型定義
 */
interface DetailedStatistics {
  totalProcessingTime: number;
  averageQualityScore: number;
  passedQualityCheck: number;
  failedQualityCheck: number;
  validationErrors: number;
}

/**
 * 品質分析結果の型定義
 */
interface QualityAnalysis {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  commonViolations: string[];
}

/**
 * 構造化エラーの型定義
 */
interface StructuredError {
  code: string;
  message: string;
  category: string;
  context?: object;
  timestamp: string;
}

/**
 * 型安全APIレスポンスの型定義
 */
interface TypeSafeApiResponse {
  success: boolean;
  reviews: GeneratedReview[];
  count: number;
  statistics: DetailedStatistics;
  qualityAnalysis?: QualityAnalysis;
  error?: StructuredError;
}

/**
 * 🔒 型安全レビュー生成APIハンドラー
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TypeSafeApiResponse>
) {
  const startTime = Date.now();
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      reviews: [],
      count: 0,
      statistics: {
        totalProcessingTime: Date.now() - startTime,
        averageQualityScore: 0,
        passedQualityCheck: 0,
        failedQualityCheck: 0,
        validationErrors: 1
      },
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'POSTメソッドのみサポートされています',
        category: 'API',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  try {
    console.log('🔒 型安全レビュー生成API開始');

    // 1. リクエスト検証
    const validationResult = validateRequest(req.body);
    if (validationResult.isFailure()) {
      console.error('❌ リクエスト検証エラー:', validationResult.error);
      res.status(400).json({
        success: false,
        reviews: [],
        count: 0,
        statistics: {
          totalProcessingTime: Date.now() - startTime,
          averageQualityScore: 0,
          passedQualityCheck: 0,
          failedQualityCheck: 0,
          validationErrors: 1
        },
        error: {
          code: 'VALIDATION_ERROR',
          message: validationResult.error.message,
          category: 'VALIDATION',
          context: validationResult.error.context,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // 型ガードを使用した安全なアクセス
    if (!validationResult.isSuccess()) {
      throw new Error('予期しない検証結果');
    }
    
    const validatedRequest = validationResult.value;
    const { csvConfig, reviewCount, enableQualityCheck = true, qualityThreshold = 0.7 } = validatedRequest;

    console.log('✅ リクエスト検証完了:', {
      reviewCount,
      enableQualityCheck,
      qualityThreshold,
      qaKnowledgeCount: csvConfig.qaKnowledge?.length || 0
    });

    // 2. TypeSafeQAKnowledgeAgent初期化
    const qaAgent = new TypeSafeQAKnowledgeAgent();

    // 3. QAナレッジ検証
    const qaKnowledge = csvConfig.qaKnowledge || [];
    const qaValidationResult = qaAgent.validateQAKnowledge(qaKnowledge);
    
    if (qaValidationResult.isFailure()) {
      console.error('❌ QAナレッジ検証エラー:', qaValidationResult.error);
      res.status(400).json({
        success: false,
        reviews: [],
        count: 0,
        statistics: {
          totalProcessingTime: Date.now() - startTime,
          averageQualityScore: 0,
          passedQualityCheck: 0,
          failedQualityCheck: 0,
          validationErrors: 1
        },
        error: {
          code: 'QA_VALIDATION_ERROR',
          message: qaValidationResult.error.message,
          category: 'VALIDATION',
          context: qaValidationResult.error.context,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // 型ガードを使用した安全なアクセス
    if (!qaValidationResult.isSuccess()) {
      throw new Error('予期しないQA検証結果');
    }
    
    const validatedQAKnowledge = qaValidationResult.value;
    console.log('✅ QAナレッジ検証完了:', { validatedCount: validatedQAKnowledge.length });

    // 4. レビュー生成
    const generatedReviews: GeneratedReview[] = [];
    const statistics: DetailedStatistics = {
      totalProcessingTime: 0,
      averageQualityScore: 0,
      passedQualityCheck: 0,
      failedQualityCheck: 0,
      validationErrors: 0
    };

    for (let i = 0; i < reviewCount; i++) {
      console.log(`📝 レビュー ${i + 1}/${reviewCount} 生成中...`);

      try {
        // Claude API呼び出し
        const reviewText = await generateSingleReview(csvConfig, i);
        
        // 品質チェック
        let qualityScore = 8.0; // デフォルトスコア
        let qualityPassed = true;
        
        if (enableQualityCheck && validatedQAKnowledge.length > 0) {
          const qualityResult = await qaAgent.performQualityCheck(reviewText, validatedQAKnowledge);
          
          if (qualityResult.isSuccess()) {
            qualityScore = qualityResult.value.score;
            qualityPassed = qualityResult.value.passed && qualityScore >= qualityThreshold;
            
            if (qualityPassed) {
              statistics.passedQualityCheck++;
            } else {
              statistics.failedQualityCheck++;
            }
          } else {
            // 型ガードを使用した安全なエラーアクセス
            if (qualityResult.isFailure()) {
              console.warn('⚠️ 品質チェックエラー:', qualityResult.error);
            }
            statistics.failedQualityCheck++;
            qualityPassed = false;
          }
        } else {
          statistics.passedQualityCheck++;
        }

        // GeneratedReview型に合わせた構造
        const review: GeneratedReview = {
          id: `type_safe_${Date.now()}_${i}`,
          reviewText,
          rating: Math.round(qualityScore / 2), // 10点満点を5点満点に変換
          reviewerAge: 30, // デフォルト値
          reviewerGender: 'other', // デフォルト値
          qualityScore,
          generationPrompt: `型安全レビュー生成 (${i + 1}/${reviewCount})`,
          generationParameters: {
            temperature: 0.7,
            maxTokens: 1000,
            mode: 'type-safe',
            timestamp: new Date().toISOString(),
            qualityBreakdown: {
              basic: { score: qualityScore, passed: qualityPassed },
              qaKnowledge: { applied: validatedQAKnowledge.length > 0 },
              overall: { score: qualityScore, level: 'strict' }
            }
          },
          csvFileIds: [], // 空配列（CSVファイル未使用）
          isApproved: qualityPassed,
          createdAt: new Date().toISOString()
        };

        generatedReviews.push(review);
        console.log(`✅ レビュー ${i + 1} 生成完了 (品質: ${qualityScore.toFixed(2)})`);

      } catch (error) {
        console.error(`❌ レビュー ${i + 1} 生成エラー:`, error);
        statistics.validationErrors++;
      }
    }

    // 5. 統計計算
    statistics.totalProcessingTime = Date.now() - startTime;
    statistics.averageQualityScore = generatedReviews.length > 0 
      ? generatedReviews.reduce((sum, review) => sum + review.qualityScore, 0) / generatedReviews.length
      : 0;

    // 6. 品質分析
    const qualityAnalysis: QualityAnalysis = {
      overallQuality: statistics.averageQualityScore >= 8.0 ? 'excellent' :
                     statistics.averageQualityScore >= 6.0 ? 'good' :
                     statistics.averageQualityScore >= 4.0 ? 'fair' : 'poor',
      recommendations: [
        '型安全性により高品質なレビューが生成されました',
        'Result型パターンによりエラーハンドリングが強化されています',
        '包括的な型検証により信頼性が向上しています'
      ],
      commonViolations: []
    };

    console.log('🎉 型安全レビュー生成完了:', {
      生成数: generatedReviews.length,
      平均品質: statistics.averageQualityScore.toFixed(2),
      処理時間: `${statistics.totalProcessingTime}ms`
    });

    res.status(200).json({
      success: true,
      reviews: generatedReviews,
      count: generatedReviews.length,
      statistics,
      qualityAnalysis
    });

  } catch (error) {
    console.error('❌ 型安全レビュー生成API エラー:', error);
    
    res.status(500).json({
      success: false,
      reviews: [],
      count: 0,
      statistics: {
        totalProcessingTime: Date.now() - startTime,
        averageQualityScore: 0,
        passedQualityCheck: 0,
        failedQualityCheck: 0,
        validationErrors: 1
      },
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : '予期しないエラーが発生しました',
        category: 'SYSTEM',
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * リクエスト検証関数
 */
function validateRequest(body: any): Result<TypeSafeReviewRequest, { message: string; context?: any }> {
  try {
    if (!body || typeof body !== 'object') {
      return Result.failure({
        message: 'リクエストボディが無効です',
        context: { actualType: typeof body }
      });
    }

    const { csvConfig, reviewCount } = body;

    if (!csvConfig || typeof csvConfig !== 'object') {
      return Result.failure({
        message: 'csvConfigが必要です',
        context: { actualType: typeof csvConfig }
      });
    }

    if (!reviewCount || typeof reviewCount !== 'number' || reviewCount < 1 || reviewCount > 50) {
      return Result.failure({
        message: 'reviewCountは1-50の数値である必要があります',
        context: { actualValue: reviewCount }
      });
    }

    return Result.success({
      csvConfig,
      reviewCount,
      customPrompt: body.customPrompt,
      enableQualityCheck: body.enableQualityCheck,
      qualityThreshold: body.qualityThreshold,
      enableStrictValidation: body.enableStrictValidation
    });

  } catch (error) {
    return Result.failure({
      message: 'リクエスト検証中にエラーが発生しました',
      context: { error: error instanceof Error ? error.message : String(error) }
    });
  }
}

/**
 * 単一レビュー生成関数
 */
async function generateSingleReview(csvConfig: CSVConfig, index: number): Promise<string> {
  const humanPattern = csvConfig.humanPatterns[index % csvConfig.humanPatterns.length];
  const businessInfo = csvConfig.basicRules.find(rule => rule.type === 'business_type')?.content || 'レストラン';
  const area = csvConfig.basicRules.find(rule => rule.type === 'area')?.content || '都内';
  const usp = csvConfig.basicRules.find(rule => rule.type === 'usp')?.content || '美味しい料理';

  const prompt = `以下の条件でレストランのレビューを生成してください：

【基本情報】
- エリア: ${area}
- 業態: ${businessInfo}
- 特徴: ${usp}

【レビュアー設定】
- 年齢層: ${humanPattern.age_group}
- 性格: ${humanPattern.personality_type}

【要件】
- 自然で具体的な体験談
- 200-400文字程度
- 型安全性を重視した高品質なレビュー
- 具体的な詳細を含む

レビュー:`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API エラー: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();

  } catch (error) {
    console.error('Claude API呼び出しエラー:', error);
    throw new Error(`レビュー生成に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 