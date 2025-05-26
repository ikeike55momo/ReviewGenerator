/**
 * @file generate-reviews.ts
 * @description レビュー生成APIエンドポイント（Netlify Functions互換）
 * 主な機能：CSVConfig受け取り、エージェント連携、レビュー生成・品質チェック・結果返却、データベース保存
 * 制限事項：環境変数からAPIキー取得、エラーハンドリング、型安全
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVParserAgent } from '../../agents/CSVParserAgent';
import { DynamicPromptBuilderAgent } from '../../agents/DynamicPromptBuilderAgent';
import { ReviewGeneratorAgent } from '../../agents/ReviewGeneratorAgent';
import { QualityControllerAgent } from '../../agents/QualityControllerAgent';
import { CSVConfig } from '../../types/csv';
import { ReviewRequest, GeneratedReview } from '../../types/review';
import { 
  createGenerationBatch, 
  updateBatchStatus, 
  saveGeneratedReview, 
  logQualityCheck,
  ReviewGenerationParams,
  GeneratedReview as DBGeneratedReview
} from '../../utils/database';

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  ageDistribution?: {
    min: number;
    max: number;
  };
  genderDistribution?: {
    male: number;
    female: number;
    other: number;
  };
  ratingDistribution?: {
    [key: number]: number;
  };
  csvFileIds?: string[];
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
      gender: 'male', // デフォルト値（CSVにgenderがないため固定値）
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
    const { 
      csvConfig, 
      reviewCount, 
      customPrompt, 
      ageDistribution, 
      genderDistribution, 
      ratingDistribution,
      csvFileIds 
    }: GenerateReviewsRequest = req.body;

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

    // 生成パラメータの準備
    const generationParams: ReviewGenerationParams = {
      count: reviewCount,
      ageDistribution: ageDistribution || { min: 20, max: 60 },
      genderDistribution: genderDistribution || { male: 50, female: 45, other: 5 },
      ratingDistribution: ratingDistribution || { 1: 5, 2: 10, 3: 20, 4: 35, 5: 30 },
      customPrompt,
    };

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('generate-reviews API: ANTHROPIC_API_KEY環境変数が設定されていません');
      return res.status(500).json({ 
        error: 'サーバー設定エラー: APIキーが設定されていません' 
      });
    }

    // データベースに生成バッチを作成
    const batchId = await createGenerationBatch(
      generationParams,
      csvFileIds || [],
      `Review_Batch_${new Date().toISOString()}`
    );

    // バッチステータスを処理中に更新
    await updateBatchStatus(batchId, 'processing');

    // エージェント初期化
    const csvParserAgent = new CSVParserAgent();
    const promptBuilderAgent = new DynamicPromptBuilderAgent();
    const reviewGeneratorAgent = new ReviewGeneratorAgent(anthropicApiKey);
    const qualityControllerAgent = new QualityControllerAgent();

    // レビューリクエスト生成
    const reviewRequests = generateReviewRequests(csvConfig, reviewCount);
    const generatedReviews: GeneratedReview[] = [];
    const dbGeneratedReviews: DBGeneratedReview[] = [];

    console.log(`generate-reviews API: ${reviewCount}件のレビュー生成を開始 (バッチID: ${batchId})`);

    // 各レビューを順次生成（並列処理は将来の拡張で対応）
    for (let i = 0; i < reviewRequests.length; i++) {
      const request = reviewRequests[i];
      let generatedPrompt = '';

      try {
        // プロンプト生成
        generatedPrompt = customPrompt || promptBuilderAgent.buildPrompt(csvConfig, request);

        // レビュー生成
        const rawReview = await reviewGeneratorAgent.generateReview(generatedPrompt, request);

        // 品質チェック
        const qualityCheckedReview = qualityControllerAgent.checkQuality(rawReview, csvConfig);

        generatedReviews.push(qualityCheckedReview);

        // データベースに保存
        const dbReview: DBGeneratedReview = {
          reviewText: qualityCheckedReview.text,
          rating: Math.floor(Math.random() * 5) + 1, // 実際の評価は要件に応じて調整
          reviewerAge: typeof request.age_group === 'string' ? 
            parseInt(request.age_group.split('-')[0]) || 30 : 30,
          reviewerGender: request.gender === 'male' ? 'male' : 
                         request.gender === 'female' ? 'female' : 'other',
          qualityScore: qualityCheckedReview.score / 10, // 10点満点を1点満点に変換
          generationPrompt: generatedPrompt,
          generationParameters: generationParams,
          csvFileIds: csvFileIds || [],
          generationBatchId: batchId,
        };

        const reviewId = await saveGeneratedReview(dbReview);
        dbGeneratedReviews.push({ ...dbReview, id: reviewId });

        // 品質ログを記録
        await logQualityCheck(
          reviewId,
          'automatic_quality_check',
          qualityCheckedReview.score,
          qualityCheckedReview.score >= 6.0,
          { 
            originalScore: qualityCheckedReview.score,
            checkDetails: 'Automatic quality assessment by QualityControllerAgent'
          }
        );

        console.log(`generate-reviews API: レビュー ${i + 1}/${reviewCount} 生成完了 (スコア: ${qualityCheckedReview.score}, ID: ${reviewId})`);
      } catch (error) {
        console.error(`generate-reviews API: レビュー ${i + 1} 生成エラー`, error);
        
        // エラー時はダミーレビューを生成（品質スコア0）
        const errorReview = {
          text: `レビュー生成エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          score: 0,
          metadata: request,
        };
        
        generatedReviews.push(errorReview);

        // エラーレビューもデータベースに保存
        try {
          const dbErrorReview: DBGeneratedReview = {
            reviewText: errorReview.text,
            rating: 1,
            reviewerAge: 30,
            reviewerGender: 'other',
            qualityScore: 0,
            generationPrompt: generatedPrompt || 'Error occurred during generation',
            generationParameters: generationParams,
            csvFileIds: csvFileIds || [],
            generationBatchId: batchId,
          };

          const errorReviewId = await saveGeneratedReview(dbErrorReview);
          dbGeneratedReviews.push({ ...dbErrorReview, id: errorReviewId });
        } catch (dbError) {
          console.error('データベース保存エラー:', dbError);
        }
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