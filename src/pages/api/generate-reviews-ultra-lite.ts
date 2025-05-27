/**
 * @file generate-reviews-ultra-lite.ts
 * @description 超軽量版レビュー生成APIエンドポイント（1件のみ・最適化版ベース）
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';

export const config = {
  maxDuration: 60, // 1分
};

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
}

/**
 * 超軽量プロンプト生成関数
 */
function buildUltraLitePrompt(csvConfig: CSVConfig, selectedPattern: any): {
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
        selectedArea = areas[0].content; // ランダムではなく最初の要素
      }

      const businessTypes = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'business_type');
      if (businessTypes.length > 0) {
        selectedBusinessType = businessTypes[0].content;
      }

      const usps = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'usp');
      if (usps.length > 0) {
        selectedUSP = usps[0].content;
      }
    }
  } catch (csvError) {
    console.warn('⚠️ CSV設定解析エラー、デフォルト値を使用:', csvError);
  }

  // 固定文字数（200文字）
  const targetLength = 200;
  
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
 * Claude API呼び出し関数（超軽量版）
 */
async function callClaudeAPIUltraLite(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト

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
        max_tokens: 600,
        temperature: 0.7, // 低めの温度
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
      
      return reviewText;
    } else {
      throw new Error('Claude APIからの応答形式が予期しないものでした');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude APIリクエストがタイムアウトしました（30秒）');
    }
    
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('⚡ 超軽量レビュー生成API呼び出し:', {
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { csvConfig }: GenerateReviewsRequest = req.body;

    console.log('📊 超軽量パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      basicRulesCount: csvConfig?.basicRules?.length || 0
    });

    // 入力バリデーション
    if (!csvConfig) {
      return res.status(400).json({ 
        error: 'csvConfigは必須です'
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    console.log('✅ 超軽量環境変数チェック完了');

    // 1件のみ生成
    console.log('⚡ 超軽量1件レビュー生成開始');
    
    // ペルソナパターンを選択
    const randomPattern = csvConfig.humanPatterns[0]; // 最初のパターンを使用
    
    console.log('📝 超軽量レビュー生成中 - ペルソナ:', {
      age_group: randomPattern.age_group,
      personality_type: randomPattern.personality_type
    });
    
    // 超軽量プロンプト生成
    const { prompt, selectedElements } = buildUltraLitePrompt(csvConfig, randomPattern);
    
    console.log('🤖 Claude API呼び出し開始（超軽量版）');
    
    // Claude API呼び出し
    const reviewText = await callClaudeAPIUltraLite(prompt, anthropicApiKey);
    
    console.log('✅ Claude API成功:', { 
      textLength: reviewText.length,
      preview: reviewText.substring(0, 50) + '...'
    });

    // 年齢・性別を設定
    const ageGroup = randomPattern.age_group || '30代';
    const ageDecade = parseInt(ageGroup.replace('代', '')) || 30;
    const reviewerGender: 'male' | 'female' | 'other' = 'male'; // 固定

    const result: GeneratedReview[] = [{
      reviewText: reviewText,
      rating: 5, // 固定
      reviewerAge: ageDecade,
      reviewerGender: reviewerGender,
      qualityScore: 0.9, // 固定値
      generationPrompt: prompt,
      generationParameters: {
        selectedPattern: randomPattern,
        selectedElements: selectedElements,
        mode: 'ultra-lite',
        timestamp: new Date().toISOString()
      },
      csvFileIds: [],
      isApproved: true
    }];

    console.log('🎉 超軽量レビュー生成完了');
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ 超軽量レビュー生成エラー:', error);
    
    // AbortError（タイムアウト）の特別処理
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Claude APIリクエストがタイムアウトしました（30秒）',
        details: 'タイムアウト'
      });
    }
    
    return res.status(500).json({
      error: '超軽量レビュー生成中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 