/**
 * @file generate-reviews-medium.ts
 * @description 中間版レビュー生成APIエンドポイント（段階的機能追加）
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
 * 簡素化されたプロンプト生成関数
 */
function buildSimplifiedPrompt(csvConfig: CSVConfig, selectedPattern: any): string {
  const { basicRules } = csvConfig;
  
  // 基本要素を抽出
  const areas = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || ['池袋西口'];
  const businessTypes = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || ['SHOGUN BAR'];
  const usps = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')?.map(rule => rule.content) || [];
  
  const selectedArea = areas[Math.floor(Math.random() * areas.length)];
  const selectedBusinessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  const selectedUSP = usps.length > 0 ? usps[Math.floor(Math.random() * usps.length)] : '';
  
  const prompt = `
あなたはプロの口コミライターです。
${selectedBusinessType}（${selectedArea}のエンタメバー）について、${selectedPattern.age_group}の${selectedPattern.personality_type}として自然な日本語で口コミを生成してください。

必須要素：
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
${selectedUSP ? `- 特徴: ${selectedUSP}` : ''}

条件：
- 150-300文字程度
- 一人称視点で体験談として書く
- 絵文字は使わない
- 自然で説得力のある内容
- ${selectedPattern.age_group}らしい表現

口コミ本文のみを出力してください。
`;

  return prompt;
}

/**
 * Claude API呼び出し関数（簡素化版）
 */
async function callClaudeAPISimplified(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45秒タイムアウト

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
        temperature: 0.8,
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
      throw new Error('Claude APIリクエストがタイムアウトしました（45秒）');
    }
    
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔬 中間版レビュー生成API呼び出し:', {
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
    const { csvConfig, reviewCount, customPrompt }: GenerateReviewsRequest = req.body;

    console.log('📊 中間版パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      reviewCount,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      basicRulesCount: csvConfig?.basicRules?.length || 0
    });

    // 入力バリデーション
    if (!csvConfig || !reviewCount) {
      return res.status(400).json({ 
        error: 'csvConfigとreviewCountは必須です'
      });
    }

    if (reviewCount < 1 || reviewCount > 10) { // 中間版では10件まで
      return res.status(400).json({ 
        error: '中間版では1～10件の範囲で指定してください'
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    console.log('✅ 中間版環境変数チェック完了');

    // レビュー生成開始
    const generatedReviews: GeneratedReview[] = [];
    
    console.log(`🚀 ${reviewCount}件の中間版レビュー生成開始`);
    
    for (let i = 0; i < reviewCount; i++) {
      try {
        // ランダムにペルソナパターンを選択
        const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
        
        console.log(`📝 レビュー ${i + 1} 生成中 - ペルソナ:`, {
          age_group: randomPattern.age_group,
          personality_type: randomPattern.personality_type
        });
        
        // 簡素化されたプロンプト生成
        const prompt = buildSimplifiedPrompt(csvConfig, randomPattern);
        
        // Claude API呼び出し
        const reviewText = await callClaudeAPISimplified(prompt, anthropicApiKey);
        
        // 基本チェック
        if (reviewText.length < 50) {
          console.warn(`⚠️ レビュー ${i + 1}: 短すぎるため再生成スキップ`);
          continue;
        }
        
        // 年齢・性別を設定
        const ageGroup = randomPattern.age_group || '30代';
        const ageDecade = parseInt(ageGroup.replace('代', '')) || 30;
        const reviewerGender: 'male' | 'female' | 'other' = Math.random() > 0.5 ? 'male' : 'female';
        
        generatedReviews.push({
          reviewText: reviewText,
          rating: Math.floor(Math.random() * 2) + 4, // 4-5点
          reviewerAge: ageDecade,
          reviewerGender: reviewerGender,
          qualityScore: 0.8, // 固定値
          generationPrompt: prompt,
          generationParameters: {
            selectedPattern: randomPattern,
            mode: 'medium',
            timestamp: new Date().toISOString()
          },
          csvFileIds: [],
          isApproved: true
        });

        console.log(`✅ レビュー ${i + 1}/${reviewCount} 中間版生成完了 (文字数: ${reviewText.length})`);
        
        // API制限対策：待機時間
        if (i < reviewCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
        }
        
      } catch (error) {
        console.error(`❌ レビュー ${i + 1} 中間版生成エラー:`, error);
        
        // エラー時はスキップして次へ
        generatedReviews.push({
          reviewText: `中間版生成エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          rating: 1,
          reviewerAge: 30,
          reviewerGender: 'other',
          qualityScore: 0,
          generationPrompt: '',
          generationParameters: {
            error: true,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          },
          csvFileIds: [],
          isApproved: false
        });
      }
    }

    console.log(`🎉 中間版生成完了 - 総数: ${generatedReviews.length}`);

    return res.status(200).json(generatedReviews);

  } catch (error) {
    console.error('❌ 中間版レビュー生成システム Error:', error);
    
    return res.status(500).json({
      error: '中間版レビュー生成中に予期しないエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 