/**
 * @file generate-reviews.ts
 * @description レビュー生成APIエンドポイント（Netlify Functions互換）
 * 主な機能：CSVConfig受け取り、エージェント連携、レビュー生成・品質チェック・結果返却
 * 制限事項：環境変数からAPIキー取得、エラーハンドリング、型安全
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVParserAgent } from '../../agents/CSVParserAgent';
import { DynamicPromptBuilderAgent } from '../../agents/DynamicPromptBuilderAgent';
import { ReviewGeneratorAgent } from '../../agents/ReviewGeneratorAgent';
import { QualityControllerAgent } from '../../agents/QualityControllerAgent';
import { CSVConfig } from '../../types/csv';
import { ReviewRequest, GeneratedReview } from '../../types/review';

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  ageDistribution?: string;
  genderDistribution?: string;
}

/**
 * レビュー生成リクエストの分散処理
 * @param csvConfig CSV設定
 * @param reviewCount 生成件数
 * @returns ReviewRequestの配列
 */
function generateReviewRequests(csvConfig: CSVConfig, reviewCount: number): ReviewRequest[] {
  const { humanPatterns } = csvConfig;
  const requests: ReviewRequest[] = [];

  for (let i = 0; i < reviewCount; i++) {
    // ランダムにパターンを選択（実際の分散ロジックは要件に応じて調整）
    const randomPattern = humanPatterns[Math.floor(Math.random() * humanPatterns.length)];
    
    requests.push({
      age_group: randomPattern.age_group,
      gender: randomPattern.gender,
      companion: '友人', // デフォルト値（CSVから動的に選択する場合は拡張）
      personality_type: randomPattern.personality_type,
    });
  }

  return requests;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORSヘッダー設定（Netlify Functions対応）
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

    // 入力バリデーション
    if (!csvConfig || !reviewCount) {
      return res.status(400).json({ 
        error: 'csvConfigとreviewCountは必須です',
        details: { csvConfig: !!csvConfig, reviewCount: !!reviewCount }
      });
    }

    if (reviewCount < 1 || reviewCount > 100) {
      return res.status(400).json({ 
        error: 'reviewCountは1～100の範囲で指定してください',
        details: { reviewCount }
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('generate-reviews API: ANTHROPIC_API_KEY環境変数が設定されていません');
      return res.status(500).json({ 
        error: 'サーバー設定エラー: APIキーが設定されていません' 
      });
    }

    // エージェント初期化
    const csvParserAgent = new CSVParserAgent();
    const promptBuilderAgent = new DynamicPromptBuilderAgent();
    const reviewGeneratorAgent = new ReviewGeneratorAgent(anthropicApiKey);
    const qualityControllerAgent = new QualityControllerAgent();

    // レビューリクエスト生成
    const reviewRequests = generateReviewRequests(csvConfig, reviewCount);
    const generatedReviews: GeneratedReview[] = [];

    console.log(`generate-reviews API: ${reviewCount}件のレビュー生成を開始`);

    // 各レビューを順次生成（並列処理は将来の拡張で対応）
    for (let i = 0; i < reviewRequests.length; i++) {
      const request = reviewRequests[i];

      try {
        // プロンプト生成
        const prompt = customPrompt || promptBuilderAgent.buildPrompt(csvConfig, request);

        // レビュー生成
        const rawReview = await reviewGeneratorAgent.generateReview(prompt, request);

        // 品質チェック
        const qualityCheckedReview = qualityControllerAgent.checkQuality(rawReview, csvConfig);

        generatedReviews.push(qualityCheckedReview);

        console.log(`generate-reviews API: レビュー ${i + 1}/${reviewCount} 生成完了 (スコア: ${qualityCheckedReview.score})`);
      } catch (error) {
        console.error(`generate-reviews API: レビュー ${i + 1} 生成エラー`, error);
        
        // エラー時はダミーレビューを生成（品質スコア0）
        generatedReviews.push({
          text: `レビュー生成エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          score: 0,
          metadata: request,
        });
      }
    }

    // 品質フィルタリング（スコア6.0未満を除外）
    const filteredReviews = generatedReviews.filter(review => review.score >= 6.0);

    console.log(`generate-reviews API: 生成完了 - 総数: ${generatedReviews.length}, フィルタ後: ${filteredReviews.length}`);

    return res.status(200).json(filteredReviews);

  } catch (error) {
    console.error('generate-reviews API: 予期しないエラー', error);
    
    return res.status(500).json({ 
      error: 'レビュー生成中に予期しないエラーが発生しました',
      details: error instanceof Error ? error.message : '不明なエラー'
    });
  }
} 