/**
 * @file batch-generate.ts
 * @description バッチレビュー生成APIエンドポイント
 * 複数バッチでの大量レビュー生成・管理機能
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview, BatchGenerationRequest } from '../../types/review';
import { 
  createGenerationBatch, 
  updateBatchStatus, 
  saveGeneratedReview,
  logQualityCheck 
} from '../../utils/database';

/**
 * バッチ生成メイン処理（グローバル重複管理対応）
 * @param {BatchGenerationRequest} request - バッチ生成リクエスト
 * @param {NextApiRequest} req - Next.js APIリクエストオブジェクト
 * @returns {Promise<string[]>} 作成されたバッチID一覧
 */
async function processBatchGeneration(request: BatchGenerationRequest, req: NextApiRequest): Promise<string[]> {
  const { csvConfig, batchSize, batchCount, customPrompt, batchName } = request;
  const batchIds: string[] = [];
  const allGeneratedTexts: string[] = []; // バッチ間重複防止用
  const allUsedWordCombinations: string[] = []; // ワード組み合わせ重複防止用
  
  console.log(`🚀 バッチ生成開始: ${batchCount}バッチ × ${batchSize}件 = ${batchCount * batchSize}件`);
  
  for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
    try {
      // バッチ作成
      const currentBatchName = `${batchName || 'Batch'}_${batchIndex + 1}`;
      const batchId = await createGenerationBatch(
        {
          count: batchSize,
          ageDistribution: { min: 20, max: 60 },
          genderDistribution: { male: 40, female: 50, other: 10 },
          ratingDistribution: { 4: 30, 5: 70 },
          customPrompt: customPrompt
        },
        [], // CSVファイルIDは後で実装
        currentBatchName
      );
      
      batchIds.push(batchId);
      
      // バッチステータスを処理中に更新
      await updateBatchStatus(batchId, 'processing');
      
      console.log(`📦 バッチ ${batchIndex + 1}/${batchCount} 作成完了: ${batchId}`);
      
      // レビュー生成APIを呼び出し（バッチ間重複防止対応）
      const baseUrl = req.headers.host 
        ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
        : process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      const generateResponse = await fetch(`${baseUrl}/api/generate-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvConfig,
          reviewCount: batchSize,
          customPrompt: customPrompt ? `${customPrompt}\n\n🎲 バッチ${batchIndex + 1}/${batchCount}: より多様性のある独創的なレビューを生成してください。異なるワード組み合わせを必ず使用してください。` : `🎲 バッチ${batchIndex + 1}/${batchCount}: 他のバッチとは完全に異なる独創的なレビューを生成してください。異なるワード組み合わせを必ず使用してください。`,
          batchName: currentBatchName,
          saveToDB: true,
          existingTexts: allGeneratedTexts, // バッチ間重複防止用
          existingWordCombinations: allUsedWordCombinations // ワード組み合わせ重複防止用
        }),
      });
      
      if (!generateResponse.ok) {
        throw new Error(`バッチ ${batchIndex + 1} 生成失敗: ${generateResponse.statusText}`);
      }
      
      const generatedReviews: GeneratedReview[] = await generateResponse.json();
      
      // 生成されたテキストとワード組み合わせを記録（次のバッチでの重複防止用）
      for (const review of generatedReviews) {
        if (review.reviewText && !allGeneratedTexts.includes(review.reviewText)) {
          allGeneratedTexts.push(review.reviewText);
        }
        // ワード組み合わせも記録（配列を文字列に変換して比較）
        if (review.generationParameters?.usedWords) {
          const usedWordsString = JSON.stringify(review.generationParameters.usedWords);
          if (!allUsedWordCombinations.includes(usedWordsString)) {
            allUsedWordCombinations.push(usedWordsString);
          }
        }
      }
      
      // バッチIDを各レビューに設定
      for (const review of generatedReviews) {
        review.generationBatchId = batchId;
        await saveGeneratedReview(review);
      }
      
      // バッチステータスを完了に更新
      await updateBatchStatus(batchId, 'completed', generatedReviews.length, 0);
      
      console.log(`✅ バッチ ${batchIndex + 1}/${batchCount} 完了: ${generatedReviews.length}件生成 (累計ユニーク: ${allGeneratedTexts.length}件)`);
      
      // API制限対策：バッチ間で少し待機
      if (batchIndex < batchCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`❌ バッチ ${batchIndex + 1} エラー:`, error);
      
      if (batchIds[batchIndex]) {
        await updateBatchStatus(
          batchIds[batchIndex], 
          'failed', 
          0, 
          batchSize,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      
      // エラーが発生しても次のバッチを続行
      continue;
    }
  }
  
  return batchIds;
}

/**
 * バッチ生成APIハンドラー
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔥 API /batch-generate 呼び出し開始:', {
    method: req.method,
    headers: req.headers,
    bodyExists: !!req.body
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
    const { csvConfig, batchSize, batchCount, customPrompt, batchName }: BatchGenerationRequest = req.body;

    console.log('📊 バッチパラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      batchSize,
      batchCount,
      totalReviews: batchSize * batchCount,
      hasCustomPrompt: !!customPrompt,
      batchName
    });

    // 入力バリデーション
    if (!csvConfig || !batchSize || !batchCount) {
      console.error('❌ バリデーションエラー:', { 
        csvConfig: !!csvConfig, 
        batchSize: !!batchSize, 
        batchCount: !!batchCount 
      });
      return res.status(400).json({ 
        error: 'csvConfig、batchSize、batchCountは必須です',
        details: { csvConfig: !!csvConfig, batchSize: !!batchSize, batchCount: !!batchCount }
      });
    }

    if (batchSize < 1 || batchSize > 100) {
      console.error('❌ batchSize範囲エラー:', batchSize);
      return res.status(400).json({ 
        error: 'batchSizeは1～100の範囲で指定してください',
        details: { batchSize }
      });
    }

    if (batchCount < 1 || batchCount > 10) {
      console.error('❌ batchCount範囲エラー:', batchCount);
      return res.status(400).json({ 
        error: 'batchCountは1～10の範囲で指定してください',
        details: { batchCount }
      });
    }

    const totalReviews = batchSize * batchCount;
    if (totalReviews > 500) {
      console.error('❌ 総レビュー数制限エラー:', totalReviews);
      return res.status(400).json({ 
        error: '総レビュー数は500件以下にしてください',
        details: { totalReviews, limit: 500 }
      });
    }

    // バッチ生成実行
    const batchIds = await processBatchGeneration({
      csvConfig,
      batchSize,
      batchCount,
      customPrompt,
      batchName
    }, req);

    console.log(`🎉 バッチ生成完了: ${batchIds.length}バッチ作成`);

    return res.status(200).json({
      success: true,
      message: `${batchCount}バッチ（総${totalReviews}件）の生成を開始しました`,
      batchIds: batchIds,
      totalBatches: batchCount,
      totalReviews: totalReviews
    });

  } catch (error) {
    console.error('❌ バッチ生成システム Error:', error);
    console.error('Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return res.status(500).json({
      error: 'バッチ生成中に予期しないエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 