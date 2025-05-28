/**
 * @file reviews/generate.ts
 * @description 統合レビュー生成APIエンドポイント（セキュリティ強化・型安全性改善版）
 * 従来の複数API endpoints を統合し、型安全性とセキュリティを改善
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVParserAgent } from '../../../agents/CSVParserAgent';
import { DynamicPromptBuilderAgent } from '../../../agents/DynamicPromptBuilderAgent';
import { ReviewGeneratorAgent } from '../../../agents/ReviewGeneratorAgent';
import { QualityControllerAgent } from '../../../agents/QualityControllerAgent';
import { CSVConfig } from '../../../types/csv';
import { ReviewRequest, GeneratedReview } from '../../../types/review';
import { 
  ApiResponse, 
  createSuccessResponse, 
  createErrorResponse, 
  sanitizeInput, 
  validateApiKey 
} from '../../../utils/api-common';

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  mode: 'single' | 'batch' | 'intelligent' | 'minimal';
  saveToDB?: boolean;
}

interface GenerateReviewsResponse {
  reviews: GeneratedReview[];
  metadata: {
    totalGenerated: number;
    qualityFiltered: number;
    averageScore: number;
    processingTime: number;
  };
}

/**
 * レビュー生成設定マップ
 */
const GENERATION_MODES = {
  single: {
    maxReviews: 1,
    qualityThreshold: 0.7,
    retryAttempts: 2,
    temperature: 0.7
  },
  batch: {
    maxReviews: 20,
    qualityThreshold: 0.6,
    retryAttempts: 1,
    temperature: 0.8
  },
  intelligent: {
    maxReviews: 100,
    qualityThreshold: 0.8,
    retryAttempts: 3,
    temperature: 0.9
  },
  minimal: {
    maxReviews: 5,
    qualityThreshold: 0.5,
    retryAttempts: 1,
    temperature: 0.6
  }
} as const;

/**
 * 入力バリデーション
 */
function validateRequest(req: NextApiRequest): {
  isValid: boolean;
  error?: string;
  data?: GenerateReviewsRequest;
} {
  try {
    const sanitizedBody = sanitizeInput(req.body) as GenerateReviewsRequest;
    
    if (!sanitizedBody.csvConfig || !sanitizedBody.reviewCount || !sanitizedBody.mode) {
      return {
        isValid: false,
        error: '必須パラメータが不足しています: csvConfig, reviewCount, mode'
      };
    }

    const mode = sanitizedBody.mode;
    if (!Object.keys(GENERATION_MODES).includes(mode)) {
      return {
        isValid: false,
        error: `無効なモード: ${mode}. 利用可能: ${Object.keys(GENERATION_MODES).join(', ')}`
      };
    }

    const maxAllowed = GENERATION_MODES[mode].maxReviews;
    if (sanitizedBody.reviewCount > maxAllowed) {
      return {
        isValid: false,
        error: `${mode}モードでは最大${maxAllowed}件まで生成可能です`
      };
    }

    if (sanitizedBody.reviewCount < 1) {
      return {
        isValid: false,
        error: 'reviewCountは1以上である必要があります'
      };
    }

    return {
      isValid: true,
      data: sanitizedBody
    };
  } catch (error) {
    return {
      isValid: false,
      error: `リクエスト解析エラー: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * レビュー生成メイン処理
 */
async function generateReviews(
  request: GenerateReviewsRequest,
  apiKey: string
): Promise<GeneratedReview[]> {
  const startTime = Date.now();
  const mode = GENERATION_MODES[request.mode];
  
  const csvParser = new CSVParserAgent();
  const promptBuilder = new DynamicPromptBuilderAgent();
  const reviewGenerator = new ReviewGeneratorAgent(apiKey);
  const qualityController = new QualityControllerAgent();

  const generatedReviews: GeneratedReview[] = [];
  let attempts = 0;
  
  console.log(`🚀 ${request.mode}モードでレビュー生成開始: ${request.reviewCount}件`);

  for (let i = 0; i < request.reviewCount; i++) {
    attempts = 0;
    
    while (attempts < mode.retryAttempts) {
      try {
        attempts++;
        
        // ランダムなレビューリクエストを生成
        const reviewRequest: ReviewRequest = {
          personality_type: 'friendly', // 実際の実装では randomize
          age_group: '20代', // 実際の実装では randomize
          gender: 'other' // 実際の実装では randomize
        };

        // プロンプト生成
        const prompt = promptBuilder.buildPrompt(request.csvConfig, reviewRequest);
        
        // レビュー生成
        const review = await reviewGenerator.generateReview(prompt, reviewRequest);
        
        // 品質チェック
        const checkedReview = qualityController.checkQuality(review, request.csvConfig);
        
        // 品質閾値チェック
        if (checkedReview.qualityScore >= mode.qualityThreshold) {
          generatedReviews.push(checkedReview);
          console.log(`✅ レビュー ${i + 1} 生成完了 (スコア: ${checkedReview.qualityScore})`);
          break;
        } else if (attempts >= mode.retryAttempts) {
          console.warn(`⚠️ レビュー ${i + 1} 品質不足 (最終スコア: ${checkedReview.qualityScore})`);
          // 最終的に品質が低くても追加（フィルタリングは後で）
          generatedReviews.push(checkedReview);
          break;
        }
        
        // リトライ待機
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ レビュー ${i + 1} 生成エラー (試行 ${attempts}):`, error);
        
        if (attempts >= mode.retryAttempts) {
          // エラーレビューを追加
          generatedReviews.push({
            reviewText: `生成エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
            rating: 1,
            reviewerAge: 20,
            reviewerGender: 'other',
            qualityScore: 0,
            csvFileIds: [],
            generationPrompt: ''
          });
          break;
        }
      }
    }
    
    // API制限回避のための待機
    if (i < request.reviewCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(`🎉 生成完了: ${generatedReviews.length}件 (${processingTime}ms)`);
  
  return generatedReviews;
}

/**
 * メインハンドラー
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<GenerateReviewsResponse>>
) {
  const startTime = Date.now();
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json(
      createErrorResponse('INVALID_REQUEST', 'POST method required')
    );
  }

  try {
    // API キー検証
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('❌ ANTHROPIC_API_KEY not configured');
      return res.status(500).json(
        createErrorResponse('INTERNAL_ERROR', 'API key not configured')
      );
    }

    // リクエスト検証
    const validation = validateRequest(req);
    if (!validation.isValid || !validation.data) {
      console.error('❌ Request validation failed:', validation.error);
      return res.status(400).json(
        createErrorResponse('VALIDATION_ERROR', validation.error || 'Invalid request')
      );
    }

    const request = validation.data;
    console.log(`📥 Review generation request:`, {
      mode: request.mode,
      count: request.reviewCount,
      hasCustomPrompt: !!request.customPrompt
    });

    // レビュー生成
    const reviews = await generateReviews(request, apiKey);
    
    // 品質フィルタリング
    const mode = GENERATION_MODES[request.mode];
    const qualityFiltered = reviews.filter(r => r.qualityScore >= mode.qualityThreshold);
    
    // メタデータ計算
    const processingTime = Date.now() - startTime;
    const averageScore = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.qualityScore, 0) / reviews.length 
      : 0;

    const response: GenerateReviewsResponse = {
      reviews: qualityFiltered,
      metadata: {
        totalGenerated: reviews.length,
        qualityFiltered: qualityFiltered.length,
        averageScore: Math.round(averageScore * 100) / 100,
        processingTime
      }
    };

    console.log(`✅ API response prepared:`, {
      totalReviews: response.reviews.length,
      averageScore: response.metadata.averageScore,
      processingTime: response.metadata.processingTime
    });

    return res.status(200).json(createSuccessResponse(response));

  } catch (error) {
    console.error('❌ API Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json(
      createErrorResponse('INTERNAL_ERROR', `レビュー生成中にエラーが発生しました: ${errorMessage}`)
    );
  }
}

// Netlify Functions対応
export const config = {
  maxDuration: 120, // 2分（複数レビュー生成対応）
};