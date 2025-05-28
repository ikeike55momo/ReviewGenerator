/**
 * @file generate-reviews-simple.ts
 * @description シンプル版レビュー生成APIエンドポイント（重複チェックなし・複数件対応）
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';
import { 
  withApiHandler, 
  validateRequestBody, 
  parseAndValidateParams,
  createErrorResponse,
  createSuccessResponse,
  sendResponse,
  HTTP_STATUS,
  sanitizeInput
} from '../../utils/api-common';
import { validateCSVConfig, validateGenerationParameters } from '../../utils/validators';

export const config = {
  maxDuration: 300, // 5分
};

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
}

/**
 * シンプルプロンプト生成関数
 */
function buildSimplePrompt(csvConfig: CSVConfig, selectedPattern: any, index: number): {
  prompt: string;
  selectedElements: any;
} {
  const { basicRules } = csvConfig;
  
  // CSV設定から基本情報を抽出（エラーハンドリング強化）
  let selectedArea = '池袋西口';
  let selectedBusinessType = 'SHOGUN BAR';
  let selectedUSP = '';

  try {
    if (basicRules && Array.isArray(basicRules)) {
      const areas = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'area');
      if (areas.length > 0) {
        selectedArea = areas[index % areas.length].content; // インデックスベースで選択
      }

      const businessTypes = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'business_type');
      if (businessTypes.length > 0) {
        selectedBusinessType = businessTypes[index % businessTypes.length].content;
      }

      const usps = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'usp');
      if (usps.length > 0) {
        selectedUSP = usps[index % usps.length].content;
      }
    }
  } catch (csvError) {
    console.warn('⚠️ CSV設定解析エラー、デフォルト値を使用:', csvError);
  }

  // 文字数をインデックスベースで変動（150-300文字）
  const targetLength = 150 + (index * 30) % 150;
  
  const prompt = `
あなたはプロの口コミライターです。
${selectedBusinessType}（${selectedArea}のエンタメバー）について、${selectedPattern.age_group}の${selectedPattern.personality_type}として自然な日本語で口コミを生成してください。

必須要素：
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
${selectedUSP ? `- 特徴: ${selectedUSP}` : ''}

条件：
- ${targetLength}文字程度
- 一人称視点で体験談として書く
- 絵文字は使わない
- 自然で説得力のある内容
- ${selectedPattern.age_group}らしい表現

口コミ本文のみを出力してください。
`;

  return {
    prompt,
    selectedElements: {
      selectedArea,
      selectedBusinessType,
      selectedUSP,
      targetLength
    }
  };
}

/**
 * Claude API呼び出し関数（シンプル版）
 */
async function callClaudeAPISimple(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 40000); // 40秒タイムアウト

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        temperature: 0.8, // 適度な多様性
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Claude API Error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const responseData = await response.json();
    
    if (responseData.content && responseData.content[0] && responseData.content[0].text) {
      let reviewText = responseData.content[0].text.trim();
      
      // 基本的なクリーニング
      reviewText = reviewText.replace(/^["「]|["」]$/g, '');
      reviewText = reviewText.replace(/\n{3,}/g, '\n\n');
      reviewText = reviewText.replace(/※.*$/gm, ''); // 注釈削除
      
      return reviewText;
    } else {
      throw new Error('Claude APIからの応答形式が予期しないものでした');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude APIリクエストがタイムアウトしました（40秒）');
    }
    
    throw error;
  }
}

const simpleHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('🔧 シンプル版レビュー生成API呼び出し:', {
    method: req.method,
    timestamp: new Date().toISOString()
  });

  try {
    // 🔍 デバッグ: リクエストボディの詳細ログ
    console.log('📥 受信したリクエストボディ:', {
      hasBody: !!req.body,
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      bodySize: req.body ? JSON.stringify(req.body).length : 0
    });

    // リクエストボディの基本バリデーション
    console.log('🔍 ステップ1: リクエストボディバリデーション開始');
    const bodyValidation = validateRequestBody(req.body, ['csvConfig', 'reviewCount']);
    console.log('🔍 ステップ1結果:', {
      isValid: bodyValidation.isValid,
      errors: bodyValidation.errors
    });
    
    if (!bodyValidation.isValid) {
      console.error('❌ ステップ1失敗: リクエストボディバリデーションエラー');
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Invalid request body', bodyValidation.errors)
      );
    }

    // 入力をサニタイズ
    console.log('🔍 ステップ2: 入力サニタイズ開始');
    const sanitizedBody = sanitizeInput(req.body);
    const { csvConfig, reviewCount, customPrompt }: GenerateReviewsRequest = sanitizedBody;
    console.log('🔍 ステップ2結果:', {
      hasCsvConfig: !!csvConfig,
      csvConfigType: typeof csvConfig,
      csvConfigKeys: csvConfig ? Object.keys(csvConfig) : [],
      reviewCount,
      hasCustomPrompt: !!customPrompt
    });

    // パラメータのパースとバリデーション
    console.log('🔍 ステップ3: パラメータバリデーション開始');
    const paramValidation = parseAndValidateParams({ body: { reviewCount } } as NextApiRequest);
    console.log('🔍 ステップ3結果:', {
      errors: paramValidation.errors,
      parsedReviewCount: paramValidation.reviewCount
    });
    
    if (paramValidation.errors.length > 0) {
      console.error('❌ ステップ3失敗: パラメータバリデーションエラー');
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Invalid parameters', paramValidation.errors)
      );
    }

    // CSV設定の詳細ログ
    console.log('🔍 ステップ4: CSV設定詳細確認');
    console.log('📊 CSV設定内容:', {
      csvConfig: csvConfig ? {
        hasBasicRules: !!csvConfig.basicRules,
        basicRulesLength: csvConfig.basicRules?.length || 0,
        basicRulesType: Array.isArray(csvConfig.basicRules) ? 'array' : typeof csvConfig.basicRules,
        hasHumanPatterns: !!csvConfig.humanPatterns,
        humanPatternsLength: csvConfig.humanPatterns?.length || 0,
        humanPatternsType: Array.isArray(csvConfig.humanPatterns) ? 'array' : typeof csvConfig.humanPatterns,
        hasQaKnowledge: !!csvConfig.qaKnowledge,
        qaKnowledgeLength: csvConfig.qaKnowledge?.length || 0,
        hasSuccessExamples: !!csvConfig.successExamples,
        successExamplesLength: csvConfig.successExamples?.length || 0,
        allKeys: Object.keys(csvConfig)
      } : null
    });

    // CSV設定のバリデーション（一時的にスキップしてテスト）
    console.log('🔍 ステップ5: CSV設定バリデーション（一時的にスキップ）');
    /*
    const csvValidation = validateCSVConfig(csvConfig as any);
    if (!csvValidation.isValid) {
      console.error('❌ ステップ5失敗: CSV設定バリデーションエラー');
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Invalid CSV configuration', csvValidation.errors)
      );
    }
    */

    // シンプル版の制限チェック
    console.log('🔍 ステップ6: 制限チェック開始');
    if (reviewCount > 30) {
      console.error('❌ ステップ6失敗: レビュー数制限エラー');
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Simple version limited to 30 reviews maximum')
      );
    }
    console.log('✅ ステップ6成功: 制限チェック通過');

    console.log('📊 シンプル版パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      reviewCount,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      basicRulesCount: csvConfig?.basicRules?.length || 0
    });

    // 環境変数チェック
    console.log('🔍 ステップ7: 環境変数チェック開始');
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('❌ ステップ7失敗: ANTHROPIC_API_KEY未設定');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }
    console.log('✅ ステップ7成功: 環境変数チェック完了');

    // レビュー生成開始
    console.log('🔍 ステップ8: レビュー生成開始');
    const generatedReviews: GeneratedReview[] = [];
    
    console.log(`🔧 ${reviewCount}件のシンプル版レビュー生成開始`);
    
    for (let i = 0; i < reviewCount; i++) {
      try {
        // インデックスベースでペルソナパターンを選択
        const patternIndex = i % csvConfig.humanPatterns.length;
        const selectedPattern = csvConfig.humanPatterns[patternIndex];
        
        console.log(`📝 レビュー ${i + 1} 生成中 - ペルソナ:`, {
          index: patternIndex,
          age_group: selectedPattern.age_group,
          personality_type: selectedPattern.personality_type
        });
        
        // シンプルプロンプト生成
        const { prompt, selectedElements } = buildSimplePrompt(csvConfig, selectedPattern, i);
        
        // Claude API呼び出し
        const reviewText = await callClaudeAPISimple(prompt, anthropicApiKey);
        
        // 基本チェック（短すぎる場合のみスキップ）
        if (reviewText.length < 30) {
          console.warn(`⚠️ レビュー ${i + 1}: 短すぎるためスキップ`);
          continue;
        }
        
        // 年齢・性別を設定
        const ageGroup = selectedPattern.age_group || '30代';
        const ageDecade = parseInt(ageGroup.replace('代', '')) || 30;
        const reviewerGender: 'male' | 'female' | 'other' = i % 2 === 0 ? 'male' : 'female';
        
        generatedReviews.push({
          reviewText: reviewText,
          rating: Math.floor(Math.random() * 2) + 4, // 4-5点
          reviewerAge: ageDecade,
          reviewerGender: reviewerGender,
          qualityScore: 0.8, // 固定値
          generationPrompt: prompt,
          generationParameters: {
            selectedPattern: selectedPattern,
            selectedElements: selectedElements,
            mode: 'simple',
            index: i,
            timestamp: new Date().toISOString()
          },
          csvFileIds: [],
          isApproved: true
        });

        console.log(`✅ レビュー ${i + 1}/${reviewCount} シンプル生成完了 (文字数: ${reviewText.length})`);
        
      } catch (error) {
        console.error(`❌ レビュー ${i + 1} シンプル生成エラー:`, error);
        
        // エラーの場合はエラーレビューを追加
        generatedReviews.push({
          reviewText: `シンプル生成エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          rating: 1,
          reviewerAge: 30,
          reviewerGender: 'other',
          qualityScore: 0,
          generationPrompt: '',
          generationParameters: {
            error: true,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            index: i
          },
          csvFileIds: [],
          isApproved: false
        });
      }
      
      // API制限対策：短い待機時間
      if (i < reviewCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒待機
      }
    }

    // 成功したレビューのみをフィルタリング
    const successfulReviews = generatedReviews.filter(review => review.qualityScore > 0);

    console.log(`🎉 シンプル生成完了 - 総数: ${generatedReviews.length}, 成功: ${successfulReviews.length}`);

    return sendResponse(res, HTTP_STATUS.OK, createSuccessResponse(successfulReviews));

  } catch (error) {
    console.error('❌ シンプル版レビュー生成システム Error:', error);
    
    return sendResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse('INTERNAL_ERROR', 'Simple review generation failed', 
        error instanceof Error ? error.message : 'Unknown error')
    );
  }
};

// APIハンドラーをwithApiHandlerでラップして、CORS、メソッドチェック、エラーハンドリングを追加
export default withApiHandler(simpleHandler, {
  allowedMethods: ['POST'],
  requireAuth: false
}); 