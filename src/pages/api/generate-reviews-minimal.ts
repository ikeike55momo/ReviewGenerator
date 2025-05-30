/**
 * @file generate-reviews-minimal.ts
 * @description 最小限レビュー生成APIエンドポイント（1件のみ・CSV設定使用）
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  maxDuration: 60, // 1分
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔬 最小限レビュー生成API呼び出し:', {
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
    const { csvConfig } = req.body;

    console.log('📊 最小限パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
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

    // CSV設定から基本情報を抽出（エラーハンドリング強化）
    let selectedArea = '池袋西口';
    let selectedBusinessType = 'SHOGUN BAR';
    let selectedUSP = '';
    let selectedPattern = { age_group: '30代', personality_type: 'カジュアル' };

         try {
       if (csvConfig?.basicRules && Array.isArray(csvConfig.basicRules)) {
         const areas = csvConfig.basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'area');
         if (areas.length > 0) {
           selectedArea = areas[0].content;
         }

         const businessTypes = csvConfig.basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'business_type');
         if (businessTypes.length > 0) {
           selectedBusinessType = businessTypes[0].content;
         }

         const usps = csvConfig.basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'usp');
         if (usps.length > 0) {
           selectedUSP = usps[0].content;
         }
       }

      if (csvConfig?.humanPatterns && Array.isArray(csvConfig.humanPatterns) && csvConfig.humanPatterns.length > 0) {
        selectedPattern = csvConfig.humanPatterns[0];
      }
    } catch (csvError) {
      console.warn('⚠️ CSV設定解析エラー、デフォルト値を使用:', csvError);
    }

    console.log('🎯 選択された要素:', {
      selectedArea,
      selectedBusinessType,
      selectedUSP,
      selectedPattern
    });

    // 最小限のプロンプト
    const prompt = `
あなたはプロの口コミライターです。
${selectedBusinessType}（${selectedArea}のエンタメバー）について、${selectedPattern.age_group}の${selectedPattern.personality_type}として自然な日本語で口コミを生成してください。

必須要素：
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
${selectedUSP ? `- 特徴: ${selectedUSP}` : ''}

条件：
- 150-250文字程度
- 一人称視点で体験談として書く
- 絵文字は使わない
- 自然で説得力のある内容

口コミ本文のみを出力してください。
`;

    console.log('🤖 Claude API呼び出し開始（最小限版）');

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
        max_tokens: 600,
        temperature: 0.7,
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
        reviewerAge: parseInt(selectedPattern.age_group?.replace('代', '')) || 30,
        reviewerGender: 'male' as const,
        qualityScore: 0.8,
        generationPrompt: prompt,
        generationParameters: {
          selectedPattern: selectedPattern,
          selectedArea: selectedArea,
          selectedBusinessType: selectedBusinessType,
          selectedUSP: selectedUSP,
          mode: 'minimal',
          timestamp: new Date().toISOString()
        },
        csvFileIds: [],
        isApproved: true
      }];

      console.log('🎉 最小限レビュー生成完了');
      return res.status(200).json(result);

    } else {
      console.error('Unexpected Claude API Response:', responseData);
      throw new Error('Claude APIからの応答形式が予期しないものでした');
    }

  } catch (error) {
    console.error('❌ 最小限レビュー生成エラー:', error);
    
    // AbortError（タイムアウト）の特別処理
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(408).json({
        error: 'Claude APIリクエストがタイムアウトしました（30秒）',
        details: 'タイムアウト'
      });
    }
    
    return res.status(500).json({
      error: '最小限レビュー生成中にエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 