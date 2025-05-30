/**
 * @file generate-reviews-intelligent.ts
 * @description 知的化レビュー生成APIエンドポイント（Phase 1実装）
 * 多様性向上・品質監視・動的戦略調整機能付き
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

// ========================================
// 🧠 知的化機能（Phase 1）
// ========================================

/**
 * 知的プロンプト生成関数
 * 既存レビューを分析して多様性を向上させる
 */
function enhancePromptWithIntelligence(
  basePrompt: string, 
  existingReviews: GeneratedReview[], 
  currentIndex: number
): string {
  console.log(`🧠 知的レビュー生成開始 - ${currentIndex + 1}件目`);
  
  const diversityBoost = calculateDiversityBoost(existingReviews);
  const intelligencePrompt = `

# 🧠 知的化指示
${diversityBoost}

## 多様性強化ルール
- 既存の${existingReviews.length}件のレビューとは異なる表現を使用
- 同じ語彙の繰り返しを避ける
- 異なる体験談の角度から記述
- 感情表現のバリエーションを増やす
`;

  return basePrompt + intelligencePrompt;
}

/**
 * 多様性向上のための指示生成
 */
function calculateDiversityBoost(existingReviews: GeneratedReview[]): string {
  if (existingReviews.length === 0) {
    return "初回生成：自然で魅力的なレビューを作成してください。";
  }
  
  // 既存レビューから使用済みキーワードを抽出
  const usedKeywords = existingReviews
    .map(review => review.reviewText)
    .join(' ')
    .match(/[ぁ-んァ-ヶー一-龠]+/g) || [];
  
  const keywordFreq = usedKeywords.reduce((acc, word) => {
    if (word.length > 1) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const overusedWords = Object.entries(keywordFreq)
    .filter(([word, count]) => count >= 2)
    .map(([word]) => word);
  
  if (overusedWords.length > 0) {
    return `多様性向上：「${overusedWords.slice(0, 5).join('、')}」などの表現は避けて、新しい語彙で表現してください。`;
  }
  
  return "多様性向上：これまでとは異なる表現や体験談の角度で記述してください。";
}

/**
 * リアルタイム品質監視
 */
function analyzeRecentQuality(recentReviews: GeneratedReview[]): {
  average: number;
  trend: string;
  recommendation: string;
} {
  if (recentReviews.length === 0) {
    return { average: 0, trend: 'unknown', recommendation: 'データ不足' };
  }
  
  const scores = recentReviews.map(r => r.qualityScore || 0);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  let trend = 'stable';
  let recommendation = '品質良好';
  
  if (scores.length >= 3) {
    const recent = scores.slice(-2).reduce((sum, score) => sum + score, 0) / 2;
    const earlier = scores.slice(0, -2).reduce((sum, score) => sum + score, 0) / (scores.length - 2);
    
    if (recent > earlier + 0.1) {
      trend = 'improving';
      recommendation = '品質向上中';
    } else if (recent < earlier - 0.1) {
      trend = 'declining';
      recommendation = '品質注意';
    }
  }
  
  return { average: Math.round(average * 100) / 100, trend, recommendation };
}

/**
 * 動的戦略調整
 */
function adjustStrategy(recentReviews: GeneratedReview[]): string {
  if (recentReviews.length < 3) return 'balanced';
  
  const qualityAnalysis = analyzeRecentQuality(recentReviews);
  
  if (qualityAnalysis.average < 0.6) {
    console.log('🔄 戦略変更: quality_focus（品質重視）');
    return 'quality_focus';
  } else if (qualityAnalysis.average > 0.8) {
    console.log('🔄 戦略変更: diversity_focus（多様性重視）');
    return 'diversity_focus';
  }
  
  return 'balanced';
}

/**
 * 知的品質スコアリング（簡略版）
 */
function calculateIntelligentQualityScore(
  reviewText: string,
  existingReviews: GeneratedReview[]
): number {
  // 基本品質スコア
  let basicScore = 0.7; // デフォルト値
  
  // 文字数チェック
  const length = reviewText.length;
  if (length >= 150 && length <= 400) {
    basicScore += 0.1;
  } else if (length < 100 || length > 500) {
    basicScore -= 0.2;
  }
  
  // 多様性スコア
  const diversityScore = calculateDiversityScore(reviewText, existingReviews);
  
  // 自然さスコア
  const naturalScore = calculateNaturalScore(reviewText);
  
  // 重み付け合計
  const finalScore = (
    basicScore * 0.4 +
    diversityScore * 0.3 +
    naturalScore * 0.3
  );
  
  return Math.min(1.0, Math.max(0.0, finalScore));
}

/**
 * 多様性スコア計算
 */
function calculateDiversityScore(reviewText: string, existingReviews: GeneratedReview[]): number {
  if (existingReviews.length === 0) return 1.0;
  
  const currentWords = reviewText.match(/[ぁ-んァ-ヶー一-龠]+/g) || [];
  const existingWords = existingReviews
    .map(r => r.reviewText)
    .join(' ')
    .match(/[ぁ-んァ-ヶー一-龠]+/g) || [] as string[];
  
  const uniqueWords = currentWords.filter((word: string) => 
    word.length > 1 && !existingWords.includes(word)
  );
  
  return Math.min(1.0, uniqueWords.length / Math.max(1, currentWords.length));
}

/**
 * 自然さスコア計算
 */
function calculateNaturalScore(reviewText: string): number {
  let score = 1.0;
  
  // 不自然な表現をチェック
  const unnaturalPatterns = [
    /(.{1,3})\1{3,}/g, // 同じ文字の繰り返し
    /[！]{3,}/g,      // 感嘆符の過度な使用
    /[。]{2,}/g,      // 句点の連続
  ];
  
  unnaturalPatterns.forEach(pattern => {
    if (pattern.test(reviewText)) {
      score -= 0.2;
    }
  });
  
  // 適切な長さかチェック
  if (reviewText.length < 50 || reviewText.length > 500) {
    score -= 0.1;
  }
  
  return Math.max(0.0, score);
}

/**
 * 簡略版プロンプト生成
 */
function buildSimplePrompt(csvConfig: CSVConfig, selectedPattern: any): string {
  const { basicRules } = csvConfig;
  
  // 基本要素を抽出
  const areas = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || ['池袋西口'];
  const businessTypes = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || ['SHOGUN BAR'];
  const usps = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')?.map(rule => rule.content) || ['日本酒'];
  const environments = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')?.map(rule => rule.content) || ['アクセス抜群'];
  const recommendations = basicRules?.filter(rule => rule.category === 'recommendation_phrases')?.map(rule => rule.content) || ['日本酒好きに'];
  
  const selectedArea = areas[Math.floor(Math.random() * areas.length)];
  const selectedBusinessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  const selectedUSP = usps[Math.floor(Math.random() * usps.length)];
  const selectedEnvironment = environments[Math.floor(Math.random() * environments.length)];
  const selectedRecommendation = recommendations[Math.floor(Math.random() * recommendations.length)];
  
  return `
# Google口コミ生成

以下の条件でGoogle口コミを生成してください：

## 必須要素
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
- 特徴: ${selectedUSP}
- 環境: ${selectedEnvironment}
- 推奨: ${selectedRecommendation}

## ペルソナ
- 年代: ${selectedPattern.age_group}
- 性格: ${selectedPattern.personality_type}

## 要件
- 150-300文字程度
- 自然で人間らしい表現
- 絵文字は使用しない
- 体験談として記述
- 文末に推奨フレーズを含める

自然で魅力的なGoogle口コミを生成してください。
`;
}

/**
 * Claude API呼び出し（簡略版）
 */
async function callClaudeAPI(prompt: string, apiKey: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45秒タイムアウト

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude API request timed out');
    }
    throw error;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🧠 知的化レビュー生成API呼び出し開始');

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

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const generatedReviews: GeneratedReview[] = [];
    const maxCount = Math.min(reviewCount || 5, 30); // 最大30件

    console.log(`🚀 知的化レビュー生成開始: ${maxCount}件`);

    for (let i = 0; i < maxCount; i++) {
      try {
        // ランダムペルソナ選択
        const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
        
        // 基本プロンプト生成
        const basePrompt = buildSimplePrompt(csvConfig, randomPattern);
        
        // 🧠 知的化機能：プロンプトを強化
        const enhancedPrompt = enhancePromptWithIntelligence(basePrompt, generatedReviews, i);
        
        // 🔄 動的戦略調整（5件ごと）
        let currentStrategy = 'balanced';
        if (i % 5 === 0 && i > 0) {
          currentStrategy = adjustStrategy(generatedReviews.slice(-5));
        }
        
        // 📊 リアルタイム品質監視（5件ごと）
        if (i % 5 === 0 && i > 0) {
          const recentQuality = analyzeRecentQuality(generatedReviews.slice(-5));
          console.log(`📊 直近品質分析 (${i}件目):`, {
            average: recentQuality.average,
            trend: recentQuality.trend,
            recommendation: recentQuality.recommendation,
            strategy: currentStrategy
          });
        }
        
        // Claude API呼び出し
        const reviewText = await callClaudeAPI(enhancedPrompt, anthropicApiKey);
        
        // 🧠 知的品質スコア計算
        const qualityScore = calculateIntelligentQualityScore(reviewText, generatedReviews);
        
        console.log(`🧠 知的品質スコア (レビュー ${i + 1}):`, {
          score: qualityScore,
          length: reviewText.length,
          diversity: calculateDiversityScore(reviewText, generatedReviews),
          natural: calculateNaturalScore(reviewText)
        });
        
                 // レビューオブジェクト作成
         const review: GeneratedReview = {
           reviewText: reviewText,
           rating: Math.floor(Math.random() * 2) + 4, // 4-5点
           reviewerAge: parseInt(randomPattern.age_group?.replace('代', '') || '20'),
           reviewerGender: (Math.random() > 0.5 ? 'male' : 'female') as 'male' | 'female' | 'other',
           qualityScore: qualityScore,
           csvFileIds: [], // 必須フィールド
           createdAt: new Date().toISOString(),
         };
        
        generatedReviews.push(review);
        
        // API呼び出し間隔
        if (i < maxCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ レビュー ${i + 1} 生成エラー:`, error);
        continue; // 次のレビューに進む
      }
    }

    // 最終品質分析
    const finalQuality = analyzeRecentQuality(generatedReviews);
    console.log('🎯 最終品質分析:', finalQuality);

    console.log(`✅ 知的化レビュー生成完了: ${generatedReviews.length}件`);

    return res.status(200).json({
      success: true,
      reviews: generatedReviews,
      count: generatedReviews.length,
      qualityAnalysis: finalQuality,
      intelligenceFeatures: {
        diversityBoost: true,
        qualityMonitoring: true,
        strategicAdjustment: true,
        intelligentScoring: true
      }
    });

  } catch (error) {
    console.error('❌ 知的化レビュー生成エラー:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Phase 1 intelligent review generation failed'
    });
  }
} 