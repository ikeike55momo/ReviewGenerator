/**
 * @file generate-reviews-debug.ts
 * @description デバッグ版レビュー生成APIエンドポイント（詳細エラー情報付き）
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';

export const config = {
  maxDuration: 120, // 2分
};

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
}

/**
 * デバッグ用プロンプト生成関数
 */
function buildDebugPrompt(csvConfig: CSVConfig, selectedPattern: any): {
  prompt: string;
  selectedElements: any;
} {
  console.log('🔍 buildDebugPrompt開始:', { csvConfig: !!csvConfig, selectedPattern });
  
  const { basicRules } = csvConfig;
  
  // CSV設定から基本情報を抽出（エラーハンドリング強化）
  let selectedArea = '池袋西口';
  let selectedBusinessType = 'SHOGUN BAR';
  let selectedUSP = '';

  try {
    console.log('🔍 basicRules処理開始:', { basicRulesExists: !!basicRules, isArray: Array.isArray(basicRules) });
    
    if (basicRules && Array.isArray(basicRules)) {
      console.log('🔍 basicRules内容:', basicRules.slice(0, 3));
      
      const areas = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'area');
      console.log('🔍 areas抽出結果:', areas);
      if (areas.length > 0) {
        selectedArea = areas[0].content;
      }

      const businessTypes = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'business_type');
      console.log('🔍 businessTypes抽出結果:', businessTypes);
      if (businessTypes.length > 0) {
        selectedBusinessType = businessTypes[0].content;
      }

      const usps = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'usp');
      console.log('🔍 usps抽出結果:', usps);
      if (usps.length > 0) {
        selectedUSP = usps[0].content;
      }
    }
  } catch (csvError) {
    console.error('❌ CSV設定解析エラー:', csvError);
    console.error('❌ CSV設定解析エラースタック:', csvError instanceof Error ? csvError.stack : 'スタック情報なし');
  }

  const targetLength = 200; // 固定
  
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

口コミ本文のみを出力してください。
`;

  const selectedElements = {
    selectedArea,
    selectedBusinessType,
    selectedUSP,
    targetLength
  };

  console.log('🔍 buildDebugPrompt完了:', selectedElements);
  
  return {
    prompt,
    selectedElements
  };
}

/**
 * Claude API呼び出し関数（デバッグ版）
 */
async function callClaudeAPIDebug(prompt: string, apiKey: string): Promise<string> {
  console.log('🔍 callClaudeAPIDebug開始:', { 
    promptLength: prompt.length, 
    apiKeyExists: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'なし'
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('⏰ Claude APIタイムアウト発生（30秒）');
    controller.abort();
  }, 30000); // 30秒タイムアウト

  try {
    const requestBody = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };
    
    console.log('🔍 Claude APIリクエスト準備完了:', {
      model: requestBody.model,
      max_tokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      messageLength: requestBody.messages[0].content.length
    });

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
    
    console.log('🔍 Claude APIレスポンス受信:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error Response:', errorData);
      throw new Error(`Claude API Error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const responseData = await response.json();
    console.log('🔍 Claude APIレスポンスデータ:', {
      hasContent: !!responseData.content,
      contentLength: responseData.content?.length || 0,
      firstContentType: responseData.content?.[0]?.type || 'なし',
      hasText: !!responseData.content?.[0]?.text
    });
    
    if (responseData.content && responseData.content[0] && responseData.content[0].text) {
      let reviewText = responseData.content[0].text.trim();
      
      console.log('🔍 Claude APIテキスト取得成功:', {
        originalLength: responseData.content[0].text.length,
        trimmedLength: reviewText.length,
        preview: reviewText.substring(0, 100) + '...'
      });
      
      // 基本的なクリーニング
      reviewText = reviewText.replace(/^["「]|["」]$/g, '');
      reviewText = reviewText.replace(/\n{3,}/g, '\n\n');
      
      console.log('🔍 テキストクリーニング完了:', {
        finalLength: reviewText.length,
        finalPreview: reviewText.substring(0, 100) + '...'
      });
      
      return reviewText;
    } else {
      console.error('❌ Claude APIレスポンス形式エラー:', responseData);
      throw new Error('Claude APIからの応答形式が予期しないものでした');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    console.error('❌ callClaudeAPIDebugエラー:', error);
    console.error('❌ エラータイプ:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ エラーメッセージ:', error instanceof Error ? error.message : String(error));
    console.error('❌ エラースタック:', error instanceof Error ? error.stack : 'スタック情報なし');
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude APIリクエストがタイムアウトしました（30秒）');
    }
    
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔍 デバッグ版レビュー生成API呼び出し:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('🔍 OPTIONSリクエスト処理');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('🔍 非POSTリクエスト:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 リクエストボディ解析開始');
    const { csvConfig }: GenerateReviewsRequest = req.body;

    console.log('🔍 デバッグ版パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      csvConfigType: typeof csvConfig,
      csvConfigKeys: csvConfig ? Object.keys(csvConfig) : [],
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      basicRulesCount: csvConfig?.basicRules?.length || 0,
      humanPatternsType: typeof csvConfig?.humanPatterns,
      basicRulesType: typeof csvConfig?.basicRules
    });

    // 入力バリデーション
    if (!csvConfig) {
      console.log('❌ csvConfig未設定');
      return res.status(400).json({ 
        error: 'csvConfigは必須です'
      });
    }

    if (!csvConfig.humanPatterns || csvConfig.humanPatterns.length === 0) {
      console.log('❌ humanPatterns未設定');
      return res.status(400).json({ 
        error: 'humanPatternsは必須です'
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    console.log('🔍 環境変数チェック:', {
      hasAnthropicApiKey: !!anthropicApiKey,
      apiKeyLength: anthropicApiKey ? anthropicApiKey.length : 0,
      apiKeyPrefix: anthropicApiKey ? anthropicApiKey.substring(0, 10) + '...' : 'なし'
    });
    
    if (!anthropicApiKey) {
      console.log('❌ ANTHROPIC_API_KEY未設定');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    console.log('✅ デバッグ版環境変数チェック完了');

    // 1件のみ生成（デバッグ用）
    console.log('🔍 デバッグ版1件レビュー生成開始');
    
    // ペルソナパターンを選択
    const selectedPattern = csvConfig.humanPatterns[0];
    
    console.log('🔍 デバッグ版レビュー生成中 - ペルソナ:', {
      age_group: selectedPattern.age_group,
      personality_type: selectedPattern.personality_type,
      patternKeys: Object.keys(selectedPattern)
    });
    
    // デバッグプロンプト生成
    const { prompt, selectedElements } = buildDebugPrompt(csvConfig, selectedPattern);
    
    console.log('🔍 Claude API呼び出し開始（デバッグ版）');
    
    // Claude API呼び出し
    const reviewText = await callClaudeAPIDebug(prompt, anthropicApiKey);
    
    console.log('✅ Claude API成功:', { 
      textLength: reviewText.length,
      preview: reviewText.substring(0, 50) + '...'
    });

    // 年齢・性別を設定
    const ageGroup = selectedPattern.age_group || '30代';
    const ageDecade = parseInt(ageGroup.replace('代', '')) || 30;
    const reviewerGender: 'male' | 'female' | 'other' = 'male';

    const result: GeneratedReview[] = [{
      reviewText: reviewText,
      rating: 5,
      reviewerAge: ageDecade,
      reviewerGender: reviewerGender,
      qualityScore: 0.9,
      generationPrompt: prompt,
      generationParameters: {
        selectedPattern: selectedPattern,
        selectedElements: selectedElements,
        mode: 'debug',
        timestamp: new Date().toISOString()
      },
      csvFileIds: [],
      isApproved: true
    }];

    console.log('🎉 デバッグ版レビュー生成完了');
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ デバッグ版レビュー生成エラー:', error);
    console.error('❌ エラータイプ:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('❌ エラーメッセージ:', error instanceof Error ? error.message : String(error));
    console.error('❌ エラースタック:', error instanceof Error ? error.stack : 'スタック情報なし');
    
    // 詳細なエラー情報を返す
    const errorDetails = {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : 'スタック情報なし',
      timestamp: new Date().toISOString()
    };
    
    // AbortError（タイムアウト）の特別処理
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Claude APIリクエストがタイムアウトしました（30秒）',
        details: errorDetails
      });
    }
    
    return res.status(500).json({
      error: 'デバッグ版レビュー生成中にエラーが発生しました',
      details: errorDetails
    });
  }
} 