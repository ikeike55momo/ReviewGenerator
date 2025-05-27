/**
 * @file batch-history.ts
 * @description バッチ履歴管理・CSV一括出力APIエンドポイント
 * 生成済みバッチの管理・検索・一括出力機能
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  getGeneratedReviews,
  getGenerationBatches,
  updateBatchStatus,
  deleteGenerationBatch,
  deleteBatchesBulk,
  deleteAllBatches,
  getDatabaseStats
} from '../../utils/database';

/**
 * CSV形式でレビューデータを出力
 * @param {any[]} reviews - レビューデータ配列
 * @returns {string} CSV文字列
 */
function generateCSV(reviews: any[]): string {
  if (reviews.length === 0) {
    return 'データがありません';
  }

  // CSVヘッダー（success_examples.csv形式）
  const headers = ['review', 'age', 'gender', 'companion', 'word', 'recommend'];

  // CSVデータ行
  const rows = reviews.map(review => {
    // 年齢を文字列形式に変換
    const ageString = `${review.reviewerAge}代`;
    
    // 性別を日本語に変換
    const genderString = review.reviewerGender === 'male' ? '男性' : 
                        review.reviewerGender === 'female' ? '女性' : 'その他';
    
    // generationParametersから使用されたキーワードと推奨フレーズを取得
    const usedWords = review.generationParameters?.usedWords || '';
    const selectedRecommendation = review.generationParameters?.selectedRecommendation || '日本酒好きに';
    
    // デバッグログ：usedWordsが空の場合の詳細情報
    if (!usedWords) {
      console.log('⚠️ usedWordsが空です:', {
        reviewId: review.id,
        hasGenerationParameters: !!review.generationParameters,
        generationParametersKeys: review.generationParameters ? Object.keys(review.generationParameters) : [],
        usedWordsValue: review.generationParameters?.usedWords,
        selectedElements: review.generationParameters?.selectedElements
      });
    }
    
    return [
      `"${(review.reviewText || '').replace(/"/g, '""')}"`, // ダブルクォートエスケープ
      ageString,
      genderString,
      '一人', // companionは常に一人（個人体験のみ）
      usedWords, // バーティカルライン区切りのキーワード
      selectedRecommendation // 使用された推奨フレーズ
    ];
  });

  // CSV文字列構築
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  
  return csvContent;
}

/**
 * バッチ履歴管理APIハンドラー
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔥 API /batch-history 呼び出し開始:', {
    method: req.method,
    query: req.query,
    bodyExists: !!req.body
  });

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONSリクエスト処理完了');
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    switch (action) {
      case 'list-batches':
        // バッチ一覧取得
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed for list-batches' });
        }

        console.log('📋 バッチ一覧取得開始');
        const batches = await getGenerationBatches();
        
        console.log(`✅ バッチ一覧取得完了: ${batches.length}件`);
        return res.status(200).json({
          success: true,
          batches: batches,
          count: batches.length
        });

      case 'list-reviews':
        // レビュー一覧取得
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed for list-reviews' });
        }

        const { batchId, minQualityScore, limit } = req.query;
        
        console.log('📋 レビュー一覧取得開始:', {
          batchId: batchId || 'all',
          minQualityScore: minQualityScore || 'none',
          limit: limit || 'none'
        });

        const reviews = await getGeneratedReviews(
          batchId as string,
          minQualityScore ? parseFloat(minQualityScore as string) : undefined,
          limit ? parseInt(limit as string) : undefined
        );
        
        console.log(`✅ レビュー一覧取得完了: ${reviews.length}件`);
        return res.status(200).json({
          success: true,
          reviews: reviews,
          count: reviews.length
        });

      case 'export-csv':
        // CSV一括出力
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed for export-csv' });
        }

        const { batchIds, minQualityScore: exportMinScore, includeUnapproved } = req.body;
        
        console.log('📤 CSV出力開始:', {
          batchIds: batchIds || 'all',
          minQualityScore: exportMinScore || 'none',
          includeUnapproved: includeUnapproved || false
        });

        let exportReviews = [];
        
        if (batchIds && batchIds.length > 0) {
          // 指定されたバッチIDのレビューを取得
          for (const batchId of batchIds) {
            const batchReviews = await getGeneratedReviews(batchId);
            exportReviews.push(...batchReviews);
          }
        } else {
          // 全レビューを取得
          exportReviews = await getGeneratedReviews();
        }

        // フィルタリング
        if (exportMinScore) {
          exportReviews = exportReviews.filter(review => 
            review.qualityScore >= parseFloat(exportMinScore)
          );
        }

        if (!includeUnapproved) {
          exportReviews = exportReviews.filter(review => review.isApproved);
        }

        // CSV生成
        const csvContent = generateCSV(exportReviews);
        
        console.log(`✅ CSV出力完了: ${exportReviews.length}件`);
        
        // CSVファイルとしてレスポンス
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="reviews_export_${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send('\uFEFF' + csvContent); // BOM付きUTF-8

      case 'batch-status':
        // バッチステータス更新
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed for batch-status' });
        }

        const { batchId: updateBatchId, status, completedCount, failedCount, errorMessage } = req.body;
        
        if (!updateBatchId || !status) {
          return res.status(400).json({ 
            error: 'batchIdとstatusは必須です',
            details: { batchId: !!updateBatchId, status: !!status }
          });
        }

        console.log('🔄 バッチステータス更新:', {
          batchId: updateBatchId,
          status,
          completedCount,
          failedCount
        });

        await updateBatchStatus(
          updateBatchId,
          status,
          completedCount,
          failedCount,
          errorMessage
        );
        
        console.log('✅ バッチステータス更新完了');
        return res.status(200).json({
          success: true,
          message: 'バッチステータスを更新しました'
        });

      case 'delete-batch':
        // 単一バッチ削除
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed for delete-batch' });
        }

        const { batchId: deleteBatchId } = req.body;
        
        if (!deleteBatchId) {
          return res.status(400).json({ 
            error: 'batchIdは必須です',
            details: { batchId: !!deleteBatchId }
          });
        }

        console.log('🗑️ 単一バッチ削除開始:', {
          batchId: deleteBatchId,
          timestamp: new Date().toISOString()
        });

        try {
          await deleteGenerationBatch(deleteBatchId);
          
          console.log('✅ 単一バッチ削除完了:', deleteBatchId);
          return res.status(200).json({
            success: true,
            message: 'バッチを削除しました',
            deletedBatchId: deleteBatchId
          });
        } catch (deleteError) {
          console.error('❌ 単一バッチ削除エラー:', deleteError);
          return res.status(500).json({
            success: false,
            error: 'バッチ削除に失敗しました',
            details: deleteError instanceof Error ? deleteError.message : 'Unknown error',
            batchId: deleteBatchId
          });
        }

      case 'delete-batches':
        // 複数バッチ一括削除
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed for delete-batches' });
        }

        const { batchIds: deleteBatchIds } = req.body;
        
        if (!deleteBatchIds || !Array.isArray(deleteBatchIds) || deleteBatchIds.length === 0) {
          return res.status(400).json({ 
            error: 'batchIds配列は必須です',
            details: { 
              batchIds: !!deleteBatchIds, 
              isArray: Array.isArray(deleteBatchIds),
              length: deleteBatchIds?.length || 0
            }
          });
        }

        console.log('🗑️ 一括バッチ削除開始:', {
          batchIds: deleteBatchIds,
          count: deleteBatchIds.length,
          timestamp: new Date().toISOString()
        });

        try {
          const deleteResult = await deleteBatchesBulk(deleteBatchIds);
          
          console.log('✅ 一括バッチ削除完了:', deleteResult);
          
          if (deleteResult.failed > 0) {
            return res.status(207).json({
              success: true,
              message: `${deleteResult.success}件のバッチを削除しました（${deleteResult.failed}件失敗）`,
              result: deleteResult,
              partialSuccess: true
            });
          } else {
            return res.status(200).json({
              success: true,
              message: `${deleteResult.success}件のバッチを削除しました`,
              result: deleteResult
            });
          }
        } catch (bulkDeleteError) {
          console.error('❌ 一括バッチ削除エラー:', bulkDeleteError);
          return res.status(500).json({
            success: false,
            error: '一括バッチ削除に失敗しました',
            details: bulkDeleteError instanceof Error ? bulkDeleteError.message : 'Unknown error',
            batchIds: deleteBatchIds
          });
        }

      case 'delete-all-batches':
        // 全バッチ削除
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed for delete-all-batches' });
        }

        console.log('🗑️ 全バッチ削除開始:', {
          timestamp: new Date().toISOString()
        });

        try {
          const deleteResult = await deleteAllBatches();
          
          console.log('✅ 全バッチ削除完了:', deleteResult);
          
          return res.status(200).json({
            success: true,
            message: `${deleteResult.success}件のバッチを削除しました`,
            result: deleteResult
          });
        } catch (deleteAllError) {
          console.error('❌ 全バッチ削除エラー:', deleteAllError);
          return res.status(500).json({
            success: false,
            error: '全バッチ削除に失敗しました',
            details: deleteAllError instanceof Error ? deleteAllError.message : 'Unknown error',
          });
        }

      case 'get-database-stats':
        // データベース統計情報取得
        if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed for get-database-stats' });
        }

        console.log('📋 データベース統計情報取得開始');
        const stats = await getDatabaseStats();
        
        console.log(`✅ データベース統計情報取得完了: ${stats.length}件`);
        return res.status(200).json({
          success: true,
          stats: stats,
          count: stats.length
        });

      default:
        console.log('❌ 不明なアクション:', action);
        return res.status(400).json({ 
          error: '不明なアクションです',
          availableActions: ['list-batches', 'list-reviews', 'export-csv', 'batch-status', 'delete-batch', 'delete-batches', 'delete-all-batches', 'get-database-stats']
        });
    }

  } catch (error) {
    console.error('❌ バッチ履歴管理システム Error:', error);
    console.error('Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return res.status(500).json({
      error: 'バッチ履歴管理中に予期しないエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 