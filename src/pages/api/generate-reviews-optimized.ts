/**
 * @file generate-reviews-optimized.ts
 * @description 最適化されたレビュー生成APIエンドポイント（実用版）
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';

export const config = {
  maxDuration: 300, // 5分
};

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
}

/**
 * 最適化されたプロンプト生成関数
 */
function buildOptimizedPrompt(csvConfig: CSVConfig, selectedPattern: any): {
  prompt: string;
  selectedElements: any;
} {
  const { basicRules } = csvConfig;
  
  // CSV設定から基本情報を抽出（エラーハンドリング強化）
  let selectedArea = '池袋西口';
  let selectedBusinessType = 'SHOGUN BAR';
  let selectedUSP = '';
  let selectedEnvironment = '';

  try {
    if (basicRules && Array.isArray(basicRules)) {
      const areas = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'area');
      if (areas.length > 0) {
        selectedArea = areas[Math.floor(Math.random() * areas.length)].content;
      }

      const businessTypes = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'business_type');
      if (businessTypes.length > 0) {
        selectedBusinessType = businessTypes[Math.floor(Math.random() * businessTypes.length)].content;
      }

      const usps = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'usp');
      if (usps.length > 0) {
        selectedUSP = usps[Math.floor(Math.random() * usps.length)].content;
      }

      const environments = basicRules.filter((rule: any) => rule.category === 'required_elements' && rule.type === 'environment');
      if (environments.length > 0) {
        selectedEnvironment = environments[Math.floor(Math.random() * environments.length)].content;
      }
    }
  } catch (csvError) {
    console.warn('⚠️ CSV設定解析エラー、デフォルト値を使用:', csvError);
  }

  // 文字数をランダムに設定（150-350文字）
  const targetLength = Math.floor(Math.random() * (350 - 150 + 1)) + 150;
  
  const prompt = `
あなたはプロの口コミライターです。
${selectedBusinessType}（${selectedArea}のエンタメバー）について、${selectedPattern.age_group}の${selectedPattern.personality_type}として自然な日本語で口コミを生成してください。

必須要素：
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
${selectedUSP ? `- 特徴: ${selectedUSP}` : ''}
${selectedEnvironment ? `- 環境: ${selectedEnvironment}` : ''}

条件：
- ${targetLength}文字程度
- 一人称視点で体験談として書く
- 絵文字は使わない
- 自然で説得力のある内容
- ${selectedPattern.age_group}らしい表現
- ${selectedPattern.personality_type}の性格を反映

口コミ本文のみを出力してください。
`;

  return {
    prompt,
    selectedElements: {
      selectedArea,
      selectedBusinessType,
      selectedUSP,
      selectedEnvironment,
      targetLength
    }
  };
}

/**
 * Claude API呼び出し関数（最適化版）
 */
async function callClaudeAPIOptimized(prompt: string, apiKey: string): Promise<string> {
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
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.85, // 多様性を高める
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
      reviewText = reviewText.replace(/\(文字数：.*\)$/gm, ''); // 文字数表示削除
      
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

/**
 * 簡易重複チェック関数
 */
function isSimpleDuplicate(newText: string, existingTexts: string[]): boolean {
  const newTextClean = newText.replace(/[。、！？\s]/g, '').toLowerCase();
  
  for (const existing of existingTexts) {
    const existingClean = existing.replace(/[。、！？\s]/g, '').toLowerCase();
    
    // 80%以上の文字が一致する場合は重複とみなす
    const similarity = calculateSimilarity(newTextClean, existingClean);
    if (similarity > 0.8) {
      return true;
    }
  }
  
  return false;
}

/**
 * 文字列類似度計算（簡易版）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * レーベンシュタイン距離計算（簡易版）
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🚀 最適化レビュー生成API呼び出し:', {
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

    console.log('📊 最適化パラメータ確認:', {
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

    if (reviewCount < 1 || reviewCount > 50) { // 最適化版では50件まで
      return res.status(400).json({ 
        error: '最適化版では1～50件の範囲で指定してください'
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    console.log('✅ 最適化環境変数チェック完了');

    // レビュー生成開始
    const generatedReviews: GeneratedReview[] = [];
    const generatedTexts: string[] = [];
    
    console.log(`🚀 ${reviewCount}件の最適化レビュー生成開始`);
    
    for (let i = 0; i < reviewCount; i++) {
      let attempts = 0;
      const maxAttempts = 2; // 最大2回試行
      
      while (attempts < maxAttempts) {
        attempts++;
        
        try {
          // ランダムにペルソナパターンを選択
          const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
          
          console.log(`📝 レビュー ${i + 1} 生成中 (試行${attempts}) - ペルソナ:`, {
            age_group: randomPattern.age_group,
            personality_type: randomPattern.personality_type
          });
          
          // 最適化されたプロンプト生成
          const { prompt, selectedElements } = buildOptimizedPrompt(csvConfig, randomPattern);
          
          // Claude API呼び出し
          const reviewText = await callClaudeAPIOptimized(prompt, anthropicApiKey);
          
          // 基本チェック
          if (reviewText.length < 50) {
            console.warn(`⚠️ レビュー ${i + 1}: 短すぎるため再試行`);
            continue;
          }
          
          // 簡易重複チェック
          if (isSimpleDuplicate(reviewText, generatedTexts)) {
            console.warn(`⚠️ レビュー ${i + 1}: 重複検出のため再試行`);
            continue;
          }
          
          // 成功：レビューを追加
          generatedTexts.push(reviewText);
          
          // 年齢・性別を設定
          const ageGroup = randomPattern.age_group || '30代';
          const ageDecade = parseInt(ageGroup.replace('代', '')) || 30;
          const reviewerGender: 'male' | 'female' | 'other' = Math.random() > 0.5 ? 'male' : 'female';
          
          generatedReviews.push({
            reviewText: reviewText,
            rating: Math.floor(Math.random() * 2) + 4, // 4-5点
            reviewerAge: ageDecade,
            reviewerGender: reviewerGender,
            qualityScore: 0.85, // 固定値
            generationPrompt: prompt,
            generationParameters: {
              selectedPattern: randomPattern,
              selectedElements: selectedElements,
              mode: 'optimized',
              attempts: attempts,
              timestamp: new Date().toISOString()
            },
            csvFileIds: [],
            isApproved: true
          });

          console.log(`✅ レビュー ${i + 1}/${reviewCount} 最適化生成完了 (文字数: ${reviewText.length}, 試行: ${attempts})`);
          break; // 成功したのでループを抜ける
          
        } catch (error) {
          console.error(`❌ レビュー ${i + 1} 最適化生成エラー (試行${attempts}):`, error);
          
          if (attempts >= maxAttempts) {
            // 最大試行回数に達した場合はエラーレビューを追加
            generatedReviews.push({
              reviewText: `最適化生成エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
              rating: 1,
              reviewerAge: 30,
              reviewerGender: 'other',
              qualityScore: 0,
              generationPrompt: '',
              generationParameters: {
                error: true,
                error_message: error instanceof Error ? error.message : 'Unknown error',
                attempts: attempts
              },
              csvFileIds: [],
              isApproved: false
            });
          }
        }
        
        // 再試行の場合は短い待機時間
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // API制限対策：待機時間
      if (i < reviewCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 800)); // 0.8秒待機
      }
    }

    // 成功したレビューのみをフィルタリング
    const successfulReviews = generatedReviews.filter(review => review.qualityScore > 0);

    console.log(`🎉 最適化生成完了 - 総数: ${generatedReviews.length}, 成功: ${successfulReviews.length}`);

    return res.status(200).json(successfulReviews);

  } catch (error) {
    console.error('❌ 最適化レビュー生成システム Error:', error);
    
    return res.status(500).json({
      error: '最適化レビュー生成中に予期しないエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 