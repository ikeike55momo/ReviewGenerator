/**
 * @file generate-reviews-lite.ts
 * @description 軽量版レビュー生成APIエンドポイント（502エラー診断用）
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  maxDuration: 60, // 1分に短縮
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔬 軽量版レビュー生成API呼び出し:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    bodySize: JSON.stringify(req.body).length
  });

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONSリクエスト処理完了');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('❌ 許可されていないメソッド:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { csvConfig, reviewCount = 1 } = req.body;

    console.log('📊 軽量版パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      reviewCount,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0
    });

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('❌ ANTHROPIC_API_KEY環境変数が設定されていません');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    console.log('✅ 環境変数チェック完了');

    // 軽量版Claude API呼び出し
    const simplePrompt = `
あなたはプロの口コミライターです。
SHOGUN BAR（池袋西口のエンタメバー）について、自然な日本語で150文字程度の口コミを1つ生成してください。

条件：
- 一人称視点で体験談として書く
- 絵文字は使わない
- 自然で説得力のある内容
- 「池袋西口」「SHOGUN BAR」を含める

口コミ本文のみを出力してください。
`;

    console.log('🤖 Claude API呼び出し開始（軽量版）');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: simplePrompt
          }
        ]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API Error:', errorData);
      throw new Error(`Claude API Error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    
    if (responseData.content && responseData.content[0] && responseData.content[0].text) {
      const reviewText = responseData.content[0].text.trim();
      
      console.log('✅ Claude API成功:', { 
        textLength: reviewText.length,
        preview: reviewText.substring(0, 50) + '...'
      });

      const result = [{
        reviewText: reviewText,
        rating: 5,
        reviewerAge: 30,
        reviewerGender: 'male' as const,
        qualityScore: 0.8,
        generationPrompt: simplePrompt,
        generationParameters: {
          mode: 'lite',
          timestamp: new Date().toISOString()
        },
        csvFileIds: [],
        isApproved: true
      }];

      console.log('🎉 軽量版レビュー生成完了');
      return res.status(200).json(result);

    } else {
      console.error('Unexpected Claude API Response:', responseData);
      throw new Error('Claude APIからの応答形式が予期しないものでした');
    }

  } catch (error) {
    console.error('❌ 軽量版レビュー生成エラー:', error);
    
    // AbortError（タイムアウト）の特別処理
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Claude APIリクエストがタイムアウトしました（30秒）',
        details: 'タイムアウト'
      });
    }
    
    return res.status(500).json({
      error: '軽量版レビュー生成中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 