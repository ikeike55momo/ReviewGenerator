/**
 * @file generate-reviews-simple.ts
 * @description シンプル版レビュー生成APIエンドポイント（統合バリデーション・コネクションプール対応）
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
import { validateCSVDataConfig, validateGenerationParameters } from '../../utils/validators';
import { ValidationHelper, CSVConfigSchema } from '../../schemas/validation';
import { getConnectionPool } from '../../config/database-pool';

export const config = {
  maxDuration: 300, // 5分
};

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  ageDistribution?: string;
  genderDistribution?: string;
}

/**
 * シンプルプロンプト生成関数
 */
function buildSimplePrompt(csvConfig: CSVConfig, selectedPattern: any, index: number): {
  prompt: string;
  selectedElements: any;
} {
  const { basicRules, qaKnowledge, successExamples } = csvConfig;
  
  // CSV設定から基本情報を抽出
  let selectedArea = '池袋西口';
  let selectedBusinessType = 'SHOGUN BAR';
  let selectedUSP = '';
  let selectedSub = '';
  let selectedEnvironment = '';
  
  // ルール分類用の配列（実際のCSV構造に対応）
  let requiredElements: string[] = [];
  let prohibitedExpressions: string[] = [];
  let recommendationPhrases: string[] = [];
  let humannessKeyPoints: string[] = [];
  let outputFormat = '';
  
  // 循環選択用のリスト
  let areaList: string[] = [];
  let businessTypeList: string[] = [];
  let uspList: string[] = [];
  let subElementsList: string[] = [];
  let environmentList: string[] = [];

  // 文字数を年代に応じて調整（150-400字の幅確保）
  const ageDecade = parseInt(selectedPattern.age_group?.replace('代', '') || '30');
  let targetLength = 200;
  
  // より幅広い文字数範囲を設定（150-400字）
  const lengthVariations = [150, 180, 220, 250, 280, 320, 350, 400];
  targetLength = lengthVariations[index % lengthVariations.length];
  
  // 年代による基本調整も維持
  if (ageDecade <= 20) {
    targetLength = Math.max(150, Math.min(300, targetLength - 20));
  } else if (ageDecade >= 50) {
    targetLength = Math.max(200, Math.min(400, targetLength + 30));
  }

  try {
    if (basicRules && Array.isArray(basicRules)) {
      basicRules.forEach((rule: any) => {
        if (!rule.content || !rule.type || !rule.category) return;
        
        switch (rule.category) {
          case 'required_elements':
            switch (rule.type) {
              case 'area':
                areaList.push(rule.content);
                break;
              case 'business_type':
                businessTypeList.push(rule.content);
                break;
              case 'usp':
                uspList.push(rule.content);
                break;
              case 'sub':
                subElementsList.push(rule.content);
                break;
              case 'environment':
                environmentList.push(rule.content);
                break;
            }
            break;
            
          case 'prohibited_expressions':
            prohibitedExpressions.push(rule.content);
            break;
            
          case 'recommendation_phrases':
            if (rule.type === 'phrase') {
              recommendationPhrases.push(rule.content);
            }
            break;
            
          case 'humanness_points':
            if (rule.type === 'key_point') {
              humannessKeyPoints.push(rule.content);
            }
            break;
            
          case 'output_format':
            if (rule.type === 'format') {
              outputFormat = rule.content;
            }
            break;
        }
      });
    }
    
    // エリアを循環的に選択（多様性確保）
    if (areaList.length > 0) {
      selectedArea = areaList[index % areaList.length];
      requiredElements.push(`エリア: ${selectedArea}`);
    }
    
    // 業種を循環的に選択（多様性確保）
    if (businessTypeList.length > 0) {
      selectedBusinessType = businessTypeList[index % businessTypeList.length];
      requiredElements.push(`業種: ${selectedBusinessType}`);
    }
    
    // USP選択とサブワード選択でtargetLengthを使用
    try {
      // USPを循環的に選択（長文時は複数使用可能）
      if (uspList.length > 0) {
        selectedUSP = uspList[index % uspList.length];
        requiredElements.push(`特徴: ${selectedUSP}`);
        
        // 長文（300字以上）の場合は追加USPも選択
        const isLongText = targetLength >= 300;
        if (isLongText && uspList.length > 1) {
          const additionalUspIndex = (index + 1) % uspList.length;
          if (additionalUspIndex !== index % uspList.length) {
            const additionalUSP = uspList[additionalUspIndex];
            selectedUSP += `, ${additionalUSP}`;
            requiredElements.push(`追加特徴: ${additionalUSP}`);
          }
        }
      }
      
      // サブ要素を自由使用（自然さ優先）
      if (subElementsList.length > 0) {
        // 短文: 1-2個、中文: 2-4個、長文: 3-6個
        let selectedSubCount = 2;
        if (targetLength >= 300) selectedSubCount = Math.min(6, subElementsList.length);
        else if (targetLength >= 220) selectedSubCount = Math.min(4, subElementsList.length);
        else selectedSubCount = Math.min(2, subElementsList.length);
        
        for (let i = 0; i < selectedSubCount; i++) {
          const subIndex = (index + i) % subElementsList.length;
          selectedSub += (i > 0 ? ', ' : '') + subElementsList[subIndex];
        }
        if (selectedSub) {
          requiredElements.push(`関連要素: ${selectedSub}`);
        }
      }

      // 環境要素を1-2個選択（インデックスベース）
      if (environmentList.length > 0) {
        const selectedEnvCount = Math.min(2, Math.max(1, Math.floor(environmentList.length / 2)));
        for (let i = 0; i < selectedEnvCount; i++) {
          const envIndex = (index + i) % environmentList.length;
          selectedEnvironment += (i > 0 ? ', ' : '') + environmentList[envIndex];
        }
        if (selectedEnvironment) {
          requiredElements.push(`環境: ${selectedEnvironment}`);
        }
      }

      console.log('📋 詳細プロンプト構築情報:', {
        selectedArea,
        selectedBusinessType,
        selectedUSP,
        selectedSub,
        selectedEnvironment,
        requiredElements: requiredElements.length,
        prohibitedExpressions: prohibitedExpressions.length,
        recommendationPhrases: recommendationPhrases.length,
        humannessKeyPoints: humannessKeyPoints.length,
        areaListLength: areaList.length,
        businessTypeListLength: businessTypeList.length,
        uspListLength: uspList.length,
        selectedAreaIndex: index % areaList.length,
        selectedBusinessTypeIndex: index % businessTypeList.length,
        selectedUspIndex: index % uspList.length,
        targetLength,
        isLongText: targetLength >= 300
      });
      
    } catch (csvError) {
      console.warn('⚠️ CSV設定解析エラー、デフォルト値を使用:', csvError);
    }
    
  } catch (csvError) {
    console.warn('⚠️ CSV設定解析エラー、デフォルト値を使用:', csvError);
  }

  // QA知識から重要なガイドラインを選択（複数選択）
  let criticalGuidelines: string[] = [];
  let importantTips: string[] = [];
  
  if (qaKnowledge && qaKnowledge.length > 0) {
    qaKnowledge.forEach((qa: any) => {
      if (qa.priority === 'Critical') {
        criticalGuidelines.push(`${qa.question} → ${qa.answer}`);
      } else if (qa.priority === 'High') {
        importantTips.push(`${qa.question} → ${qa.answer}`);
      }
    });
  }

  // 成功例から参考情報とワードタイプを選択（年代に応じて）
  let referenceExample = '';
  let targetWordType = 'Medium型'; // デフォルト
  let targetRecommendPhrase = '日本酒好きに'; // デフォルト
  
  if (successExamples && successExamples.length > 0) {
    const ageGroup = selectedPattern.age_group || '30代';
    const matchingExamples = successExamples.filter((example: any) => 
      example.age === ageGroup
    );
    
    if (matchingExamples.length > 0) {
      const selectedExample = matchingExamples[index % matchingExamples.length];
      referenceExample = `参考例（${ageGroup}）: ${selectedExample.review.substring(0, 150)}...`;
      targetWordType = selectedExample.word || 'Medium型';
      targetRecommendPhrase = selectedExample.recommend || '日本酒好きに';
    } else {
      const selectedExample = successExamples[index % successExamples.length];
      referenceExample = `参考例: ${selectedExample.review.substring(0, 150)}...`;
      targetWordType = selectedExample.word || 'Medium型';
      targetRecommendPhrase = selectedExample.recommend || '日本酒好きに';
    }
  }
  
  // 推奨フレーズをCSVから循環選択（より多様性を確保）
  if (recommendationPhrases.length > 0) {
    targetRecommendPhrase = recommendationPhrases[index % recommendationPhrases.length];
  }

  const prompt = `
あなたはプロの口コミライターです。
${selectedBusinessType}（${selectedArea}のエンタメバー）について、${selectedPattern.age_group}の${selectedPattern.personality_type}として自然な日本語で口コミを生成してください。

【必須要素（必ず含める）】
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
- メイン特徴: ${selectedUSP}
${requiredElements.map(element => `- ${element}`).join('\n')}

【年代・性格特性】
- 年代: ${selectedPattern.age_group}
- 性格タイプ: ${selectedPattern.personality_type}
- 語彙レベル: ${selectedPattern.vocabulary}
- 感嘆符使用: ${selectedPattern.exclamation_marks}
- 文体特徴: ${selectedPattern.characteristics}
- 目標ワードタイプ: ${targetWordType}

【人間らしさのポイント】
${humannessKeyPoints.map(point => `- ${point}`).join('\n')}

【絶対禁止事項】
${prohibitedExpressions.map(expr => `- "${expr}" は使用禁止`).join('\n')}
- 絵文字は一切使用禁止
- 具体的な武将名（源義経・織田信長等）は使用禁止
- "SHOGUN BAR（池袋西口）"のような括弧表記は禁止
- "ふらっと"や"偶然"等の計画性のない表現は禁止（完全予約制のため）
- "友達と"や"彼女と"等の同伴者直接言及は禁止
- 指定されていない形容詞や修飾語を業種に追加禁止（「和風バー」「モダンなバー」等）

【重要ガイドライン】
${criticalGuidelines.slice(0, 3).map(guideline => `- ${guideline}`).join('\n')}

【必須終了フレーズ】
※以下のフレーズで必ず文章を終了してください：
"${targetRecommendPhrase}おすすめです"

${referenceExample}

【基本条件】
- ${targetLength}文字程度
- 一人称視点で自然な体験談として書く
- ${selectedPattern.age_group}らしい語彙と表現を使用
- ${selectedPattern.personality_type}らしい文体で統一
- 完璧すぎず、人間らしい自然な文章にする
- ${targetWordType}の文体レベルを維持
- 必ず「${targetRecommendPhrase}おすすめです」で終了

上記の全ての条件とルールを厳守して、自然で魅力的な口コミ本文のみを出力してください。説明文やNote等は一切含めないでください。
`;

  return {
    prompt,
    selectedElements: {
      selectedArea,
      selectedBusinessType,
      selectedUSP,
      selectedSub,
      selectedEnvironment,
      requiredElements,
      prohibitedExpressions,
      recommendationPhrases,
      humannessKeyPoints,
      criticalGuidelines,
      targetLength,
      referenceExample,
      targetRecommendPhrase,
      targetWordType,
      ageGroup: selectedPattern.age_group,
      personalityType: selectedPattern.personality_type
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
        model: 'claude-sonnet-4-20250514',
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

/**
 * 年代・性別分布に基づいてペルソナパターンをフィルタリング
 */
function filterHumanPatterns(humanPatterns: any[], ageDistribution: string, genderDistribution: string): any[] {
  let filteredPatterns = [...humanPatterns];
  
  // 年代フィルタリング
  if (ageDistribution !== 'auto') {
    switch (ageDistribution) {
      case '20s':
        filteredPatterns = filteredPatterns.filter(pattern => pattern.age_group === '20代');
        break;
      case '30s':
        filteredPatterns = filteredPatterns.filter(pattern => pattern.age_group === '30代');
        break;
      case '40s':
        filteredPatterns = filteredPatterns.filter(pattern => pattern.age_group === '40代');
        break;
      case 'mixed':
        // バランス型の場合は全年代を含める
        break;
    }
  }
  
  console.log('📊 ペルソナフィルタリング結果:', {
    originalCount: humanPatterns.length,
    filteredCount: filteredPatterns.length,
    ageDistribution,
    genderDistribution,
    availableAgeGroups: filteredPatterns.map(p => p.age_group).filter((group, index, arr) => arr.indexOf(group) === index)
  });
  
  return filteredPatterns.length > 0 ? filteredPatterns : humanPatterns; // フィルタ結果が空の場合は全パターンを使用
}

const simpleHandler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('🔧 シンプル版レビュー生成API呼び出し:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    origin: req.headers.origin,
    environment: process.env.NODE_ENV
  });

  try {
    // リクエストボディの基本バリデーション
    const bodyValidation = validateRequestBody(req.body, ['csvConfig', 'reviewCount']);
    if (!bodyValidation.isValid) {
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Invalid request body', bodyValidation.errors)
      );
    }

    // 入力をサニタイズ
    const sanitizedBody = sanitizeInput(req.body);
    const { csvConfig, reviewCount, customPrompt, ageDistribution, genderDistribution }: GenerateReviewsRequest = sanitizedBody as GenerateReviewsRequest;

    // パラメータのパースとバリデーション
    const paramValidation = parseAndValidateParams({ body: { reviewCount } } as NextApiRequest);
    if (paramValidation.errors.length > 0) {
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Invalid parameters', paramValidation.errors)
      );
    }

    // CSV設定の統合バリデーション（Zodスキーマ使用）
    console.log('🔍 CSV設定バリデーション開始（Zodスキーマ使用）:', {
      csvConfigType: typeof csvConfig,
      hasBasicRules: !!csvConfig?.basicRules,
      hasHumanPatterns: !!csvConfig?.humanPatterns,
      hasQaKnowledge: !!csvConfig?.qaKnowledge,
      hasSuccessExamples: !!csvConfig?.successExamples,
      basicRulesLength: csvConfig?.basicRules?.length || 0,
      humanPatternsLength: csvConfig?.humanPatterns?.length || 0
    });

    // 新しいZodスキーマでの検証
    const zodValidation = ValidationHelper.validate(CSVConfigSchema, csvConfig);
    if (!zodValidation.success) {
      console.error('❌ Zodスキーマバリデーションエラー:', zodValidation.issues);
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'CSV設定が無効です', ValidationHelper.formatErrorMessages(zodValidation.issues))
      );
    }

    // レガシーバリデーションも実行（一時的な互換性確保）
    const csvValidation = validateCSVDataConfig(csvConfig);
    if (!csvValidation.isValid) {
      console.error('❌ CSV設定バリデーションエラー:', csvValidation.errors);
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Invalid CSV configuration', csvValidation.errors)
      );
    }

    console.log('✅ CSV設定バリデーション成功');

    // シンプル版の制限チェック
    if (reviewCount > 30) {
      return sendResponse(res, HTTP_STATUS.BAD_REQUEST,
        createErrorResponse('VALIDATION_ERROR', 'Simple version limited to 30 reviews maximum')
      );
    }

    console.log('📊 シンプル版パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      reviewCount,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      basicRulesCount: csvConfig?.basicRules?.length || 0
    });

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    console.log('✅ シンプル版環境変数チェック完了');

    // レビュー生成開始
    const generatedReviews: GeneratedReview[] = [];
    
    console.log(`🔧 ${reviewCount}件のシンプル版レビュー生成開始`);
    
    // ペルソナパターンのフィルタリング
    const filteredPatterns = filterHumanPatterns(csvConfig.humanPatterns, ageDistribution || 'auto', genderDistribution || 'auto');
    
    for (let i = 0; i < reviewCount; i++) {
      try {
        // インデックスベースでペルソナパターンを選択
        const patternIndex = i % filteredPatterns.length;
        const selectedPattern = filteredPatterns[patternIndex];
        
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
        
        // CompanionとWord、Recommendを生成
        const companionOptions = ['一人', 'パートナー', '友人', '同僚', '家族'];
        const selectedCompanion = companionOptions[i % companionOptions.length];
        
        // 実際に使用されたワードをバーティカルライン区切りで生成
        const usedWords = [
          selectedElements.selectedArea,
          selectedElements.selectedBusinessType,
          ...(selectedElements.selectedUSP ? selectedElements.selectedUSP.split(', ') : []),
          ...(selectedElements.selectedSub ? selectedElements.selectedSub.split(', ') : []),
          selectedElements.selectedEnvironment ? selectedElements.selectedEnvironment.split(', ') : []
        ].flat().filter(word => word && word.trim() !== '');
        
        const wordColumnValue = usedWords.join('|');
        
        // デバッグログ：usedWords生成の詳細
        console.log(`🔍 usedWords生成 (レビュー ${i + 1}):`, {
          selectedArea: selectedElements.selectedArea,
          selectedBusinessType: selectedElements.selectedBusinessType,
          selectedUSP: selectedElements.selectedUSP,
          selectedSub: selectedElements.selectedSub,
          selectedEnvironment: selectedElements.selectedEnvironment,
          usedWords: usedWords,
          wordColumnValue: wordColumnValue
        });
        
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
          isApproved: true,
          // CSV出力用の追加フィールド
          companion: selectedCompanion,
          word: wordColumnValue, // 実際に使用されたワードのバーティカルライン区切り
          recommend: selectedElements.targetRecommendPhrase
        });

        console.log(`✅ レビュー ${i + 1}/${reviewCount} シンプル生成完了 (文字数: ${reviewText.length}, word: ${wordColumnValue}, recommend: ${selectedElements.targetRecommendPhrase})`);
        
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
          isApproved: false,
          companion: '一人',
          word: 'エラー', // エラー時は「エラー」で統一
          recommend: 'エラー'
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