/**
 * データベース操作ユーティリティ
 * 
 * 概要:
 * - Supabaseデータベースとの各種操作
 * - CSV管理、レビュー生成、品質管理機能
 * - エラーハンドリングとログ出力
 * 
 * 主な機能:
 * - CSVファイル管理（アップロード、バリデーション、取得）
 * - レビュー生成バッチ管理
 * - 生成されたレビューの保存・取得
 * - 品質スコア管理
 * - システム設定管理
 * 
 * 制限事項:
 * - Supabase接続が必要
 * - 適切な権限設定が必要
 */

import { supabase, supabaseAdmin, TABLES, Database } from '../config/supabase';
import crypto from 'crypto';

// 型定義
type CSVFileType = 'basic_rules' | 'human_patterns' | 'qa_knowledge' | 'success_examples';
type ValidationStatus = 'pending' | 'valid' | 'invalid';
type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';
type ReviewerGender = 'male' | 'female' | 'other';

/**
 * CSVファイル情報インターface
 */
export interface CSVFileInfo {
  id?: string;
  fileName: string;
  fileType: CSVFileType;
  fileSize: number;
  contentHash: string;
  rowCount: number;
  columnCount: number;
  validationStatus?: ValidationStatus;
  validationErrors?: any;
  content?: string;
}

/**
 * レビュー生成パラメータ
 */
export interface ReviewGenerationParams {
  count: number;
  ageDistribution: {
    min: number;
    max: number;
  };
  genderDistribution: {
    male: number;
    female: number;
    other: number;
  };
  ratingDistribution: {
    [key: number]: number; // rating: percentage
  };
  customPrompt?: string;
}

/**
 * 生成されたレビュー情報
 */
export interface GeneratedReview {
  id?: string;
  reviewText: string;
  rating: number;
  reviewerAge: number;
  reviewerGender: ReviewerGender;
  qualityScore: number;
  generationPrompt?: string;
  generationParameters?: any;
  csvFileIds: string[];
  generationBatchId?: string;
  isApproved?: boolean;
}

/**
 * CSVファイルのハッシュ値を計算
 * @param {string} content - ファイル内容
 * @returns {string} SHA-256ハッシュ値
 */
export const calculateFileHash = (content: string): string => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * CSVファイルをデータベースに保存
 * @param {CSVFileInfo} fileInfo - CSVファイル情報
 * @returns {Promise<string>} 保存されたファイルのID
 */
export const saveCSVFile = async (fileInfo: CSVFileInfo): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CSV_FILES)
      .insert({
        file_name: fileInfo.fileName,
        file_type: fileInfo.fileType,
        file_size: fileInfo.fileSize,
        content_hash: fileInfo.contentHash,
        row_count: fileInfo.rowCount,
        column_count: fileInfo.columnCount,
        validation_status: fileInfo.validationStatus || 'pending',
        validation_errors: fileInfo.validationErrors,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`CSVファイル保存エラー: ${error.message}`);
    }

    console.log(`CSVファイル保存成功: ${fileInfo.fileName} (ID: ${data.id})`);
    return data.id;
  } catch (error) {
    console.error('CSVファイル保存エラー:', error);
    throw error;
  }
};

/**
 * CSVファイル一覧を取得
 * @param {CSVFileType} fileType - ファイルタイプ（オプション）
 * @returns {Promise<CSVFileInfo[]>} CSVファイル一覧
 */
export const getCSVFiles = async (fileType?: CSVFileType): Promise<CSVFileInfo[]> => {
  try {
    let query = supabase
      .from(TABLES.CSV_FILES)
      .select('*')
      .order('upload_date', { ascending: false });

    if (fileType) {
      query = query.eq('file_type', fileType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`CSVファイル取得エラー: ${error.message}`);
    }

    return data.map(file => ({
      id: file.id,
      fileName: file.file_name,
      fileType: file.file_type as CSVFileType,
      fileSize: file.file_size,
      contentHash: file.content_hash,
      rowCount: file.row_count,
      columnCount: file.column_count,
      validationStatus: file.validation_status as ValidationStatus,
      validationErrors: file.validation_errors,
    }));
  } catch (error) {
    console.error('CSVファイル取得エラー:', error);
    throw error;
  }
};

/**
 * レビュー生成バッチを作成
 * @param {ReviewGenerationParams} params - 生成パラメータ
 * @param {string[]} csvFileIds - 使用するCSVファイルID一覧
 * @param {string} batchName - バッチ名（オプション）
 * @returns {Promise<string>} 作成されたバッチID
 */
export const createGenerationBatch = async (
  params: ReviewGenerationParams,
  csvFileIds: string[],
  batchName?: string
): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.GENERATION_BATCHES)
      .insert({
        batch_name: batchName || `Batch_${new Date().toISOString()}`,
        total_count: params.count,
        generation_parameters: params,
        csv_file_ids: csvFileIds,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`生成バッチ作成エラー: ${error.message}`);
    }

    console.log(`生成バッチ作成成功: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('生成バッチ作成エラー:', error);
    throw error;
  }
};

/**
 * 生成バッチのステータスを更新
 * @param {string} batchId - バッチID
 * @param {BatchStatus} status - 新しいステータス
 * @param {number} completedCount - 完了数（オプション）
 * @param {number} failedCount - 失敗数（オプション）
 * @param {string} errorMessage - エラーメッセージ（オプション）
 * @returns {Promise<void>}
 */
export const updateBatchStatus = async (
  batchId: string,
  status: BatchStatus,
  completedCount?: number,
  failedCount?: number,
  errorMessage?: string
): Promise<void> => {
  try {
    const updateData: any = { status };
    
    if (completedCount !== undefined) updateData.completed_count = completedCount;
    if (failedCount !== undefined) updateData.failed_count = failedCount;
    if (errorMessage) updateData.error_message = errorMessage;
    if (status === 'completed' || status === 'failed') {
      updateData.end_time = new Date().toISOString();
    }

    const { error } = await supabase
      .from(TABLES.GENERATION_BATCHES)
      .update(updateData)
      .eq('id', batchId);

    if (error) {
      throw new Error(`バッチステータス更新エラー: ${error.message}`);
    }

    console.log(`バッチステータス更新成功: ${batchId} -> ${status}`);
  } catch (error) {
    console.error('バッチステータス更新エラー:', error);
    throw error;
  }
};

/**
 * 生成されたレビューを保存
 * @param {GeneratedReview} review - レビュー情報
 * @returns {Promise<string>} 保存されたレビューのID
 */
export const saveGeneratedReview = async (review: GeneratedReview): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.GENERATED_REVIEWS)
      .insert({
        review_text: review.reviewText,
        rating: review.rating,
        reviewer_age: review.reviewerAge,
        reviewer_gender: review.reviewerGender,
        quality_score: review.qualityScore,
        generation_prompt: review.generationPrompt,
        generation_parameters: review.generationParameters,
        csv_file_ids: review.csvFileIds,
        generation_batch_id: review.generationBatchId,
        is_approved: review.isApproved || false,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`レビュー保存エラー: ${error.message}`);
    }

    console.log(`レビュー保存成功: ID ${data.id}`);
    return data.id;
  } catch (error) {
    console.error('レビュー保存エラー:', error);
    throw error;
  }
};

/**
 * 生成されたレビュー一覧を取得
 * @param {string} batchId - バッチID（オプション）
 * @param {number} minQualityScore - 最小品質スコア（オプション）
 * @param {number} limit - 取得件数制限（オプション）
 * @returns {Promise<GeneratedReview[]>} レビュー一覧
 */
export const getGeneratedReviews = async (
  batchId?: string,
  minQualityScore?: number,
  limit?: number
): Promise<GeneratedReview[]> => {
  try {
    let query = supabase
      .from(TABLES.GENERATED_REVIEWS)
      .select('*')
      .order('created_at', { ascending: false });

    if (batchId) {
      query = query.eq('generation_batch_id', batchId);
    }

    if (minQualityScore !== undefined) {
      query = query.gte('quality_score', minQualityScore);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`レビュー取得エラー: ${error.message}`);
    }

    return data.map(review => ({
      id: review.id,
      reviewText: review.review_text,
      rating: review.rating,
      reviewerAge: review.reviewer_age,
      reviewerGender: review.reviewer_gender as ReviewerGender,
      qualityScore: review.quality_score,
      generationPrompt: review.generation_prompt,
      generationParameters: review.generation_parameters,
      csvFileIds: review.csv_file_ids,
      generationBatchId: review.generation_batch_id,
      isApproved: review.is_approved,
    }));
  } catch (error) {
    console.error('レビュー取得エラー:', error);
    throw error;
  }
};

/**
 * システム設定を取得
 * @param {string} settingKey - 設定キー
 * @returns {Promise<string | null>} 設定値
 */
export const getSystemSetting = async (settingKey: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SYSTEM_SETTINGS)
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // 設定が見つからない場合
        return null;
      }
      throw new Error(`システム設定取得エラー: ${error.message}`);
    }

    return data.setting_value;
  } catch (error) {
    console.error('システム設定取得エラー:', error);
    throw error;
  }
};

/**
 * システム設定を更新
 * @param {string} settingKey - 設定キー
 * @param {string} settingValue - 設定値
 * @returns {Promise<void>}
 */
export const updateSystemSetting = async (
  settingKey: string,
  settingValue: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from(TABLES.SYSTEM_SETTINGS)
      .upsert({
        setting_key: settingKey,
        setting_value: settingValue,
      });

    if (error) {
      throw new Error(`システム設定更新エラー: ${error.message}`);
    }

    console.log(`システム設定更新成功: ${settingKey} = ${settingValue}`);
  } catch (error) {
    console.error('システム設定更新エラー:', error);
    throw error;
  }
};

/**
 * アクティブなプロンプトテンプレートを取得
 * @param {string} templateName - テンプレート名（オプション）
 * @returns {Promise<string>} プロンプトテンプレート
 */
export const getActivePromptTemplate = async (templateName?: string): Promise<string> => {
  try {
    let query = supabase
      .from(TABLES.PROMPT_TEMPLATES)
      .select('template_content')
      .eq('is_active', true);

    if (templateName) {
      query = query.eq('template_name', templateName);
    } else {
      query = query.eq('template_name', 'default_review_prompt');
    }

    const { data, error } = await query.single();

    if (error) {
      throw new Error(`プロンプトテンプレート取得エラー: ${error.message}`);
    }

    return data.template_content;
  } catch (error) {
    console.error('プロンプトテンプレート取得エラー:', error);
    throw error;
  }
};

/**
 * 生成バッチ一覧を取得
 * @param {BatchStatus} status - バッチステータス（オプション）
 * @param {number} limit - 取得件数制限（オプション）
 * @returns {Promise<any[]>} バッチ一覧
 */
export const getGenerationBatches = async (
  status?: BatchStatus,
  limit?: number
): Promise<any[]> => {
  try {
    let query = supabase
      .from(TABLES.GENERATION_BATCHES)
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`バッチ一覧取得エラー: ${error.message}`);
    }

    return data.map(batch => ({
      id: batch.id,
      batchName: batch.batch_name,
      totalCount: batch.total_count,
      completedCount: batch.completed_count,
      failedCount: batch.failed_count,
      status: batch.status,
      generationParameters: batch.generation_parameters,
      csvFileIds: batch.csv_file_ids,
      startTime: batch.start_time,
      endTime: batch.end_time,
      errorMessage: batch.error_message,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at,
    }));
  } catch (error) {
    console.error('バッチ一覧取得エラー:', error);
    throw error;
  }
};

/**
 * 品質ログを記録
 * @param {string} reviewId - レビューID
 * @param {string} qualityCheckType - 品質チェックタイプ
 * @param {number} score - スコア
 * @param {boolean} passed - 合格フラグ
 * @param {any} details - 詳細情報（オプション）
 * @returns {Promise<void>}
 */
export const logQualityCheck = async (
  reviewId: string,
  qualityCheckType: string,
  score: number,
  passed: boolean,
  details?: any
): Promise<void> => {
  try {
    const { error } = await supabase
      .from(TABLES.QUALITY_LOGS)
      .insert({
        review_id: reviewId,
        quality_check_type: qualityCheckType,
        score,
        passed,
        details,
      });

    if (error) {
      throw new Error(`品質ログ記録エラー: ${error.message}`);
    }

    console.log(`品質ログ記録成功: ${reviewId} - ${qualityCheckType}`);
  } catch (error) {
    console.error('品質ログ記録エラー:', error);
    throw error;
  }
};

/**
 * 既存のレビューテキストをページネーションで取得（重複チェック用）
 * @param {number} page - ページ番号（0ベース）
 * @param {number} pageSize - ページサイズ（デフォルト: 100）
 * @returns {Promise<{reviews: string[], hasMore: boolean, total: number}>} ページネーション結果
 */
export const getExistingReviewsPaginated = async (page: number = 0, pageSize: number = 100): Promise<{
  reviews: string[];
  hasMore: boolean;
  total: number;
}> => {
  try {
    console.log(`📚 既存レビュー取得開始 (ページ: ${page + 1}, サイズ: ${pageSize})`);
    
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = await supabase
      .from(TABLES.GENERATED_REVIEWS)
      .select('review_text', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`既存レビュー取得エラー: ${error.message}`);
    }

    const total = count || 0;
    const hasMore = to < total - 1;
    const reviews = data.map(review => review.review_text);
    
    console.log(`✅ 既存レビュー取得完了: ${reviews.length}件 (ページ: ${page + 1}/${Math.ceil(total / pageSize)}, 総件数: ${total}件)`);
    
    return {
      reviews,
      hasMore,
      total
    };
  } catch (error) {
    console.error('既存レビュー取得エラー:', error);
    return {
      reviews: [],
      hasMore: false,
      total: 0
    };
  }
};

/**
 * 既存のレビューテキストを全て取得（下位互換性のため保持）
 * @param {number} limit - 取得件数制限（デフォルト: 100、最大: 1000）
 * @returns {Promise<string[]>} 既存レビューテキスト一覧
 * @deprecated getExistingReviewsPaginated を使用してください
 */
export const getExistingReviews = async (limit: number = 100): Promise<string[]> => {
  // セーフガード: 最大値を制限
  const safeLimit = Math.min(limit, 1000);
  
  try {
    console.log(`📚 既存レビュー取得開始 (制限: ${safeLimit}件) - DEPRECATED: getExistingReviewsPaginated を使用してください`);
    
    const { data, error, count } = await supabase
      .from(TABLES.GENERATED_REVIEWS)
      .select('review_text', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw new Error(`既存レビュー取得エラー: ${error.message}`);
    }

    console.log(`✅ 既存レビュー取得完了: ${data.length}件 (総件数: ${count}件)`);
    return data.map(review => review.review_text);
  } catch (error) {
    console.error('既存レビュー取得エラー:', error);
    return []; // エラー時は空配列を返す
  }
};

/**
 * 生成バッチを削除（関連するレビューも削除）
 * @param {string} batchId - 削除するバッチID
 * @returns {Promise<void>}
 */
export const deleteGenerationBatch = async (batchId: string): Promise<void> => {
  try {
    console.log(`🗑️ バッチ削除開始: ${batchId}`);
    
    // 管理者権限クライアントを使用（権限問題を回避）
    const client = supabaseAdmin || supabase;
    console.log(`🔑 使用クライアント: ${supabaseAdmin ? 'Admin' : 'Standard'}`);
    
    // バッチの存在確認
    const { data: batchExists, error: batchCheckError } = await client
      .from(TABLES.GENERATION_BATCHES)
      .select('id, batch_name, total_count, completed_count')
      .eq('id', batchId)
      .single();

    if (batchCheckError) {
      if (batchCheckError.code === 'PGRST116') {
        console.warn(`⚠️ バッチが見つかりません: ${batchId}`);
        return; // 既に削除済み
      }
      throw new Error(`バッチ存在確認エラー: ${batchCheckError.message} (Code: ${batchCheckError.code})`);
    }

    console.log(`📋 削除対象バッチ確認:`, {
      id: batchExists.id,
      name: batchExists.batch_name,
      totalCount: batchExists.total_count,
      completedCount: batchExists.completed_count
    });

    // 関連するレビューIDを取得（削除前に）
    const { data: reviewIds, error: reviewSelectError, count: reviewCount } = await client
      .from(TABLES.GENERATED_REVIEWS)
      .select('id', { count: 'exact' })
      .eq('generation_batch_id', batchId);

    if (reviewSelectError) {
      console.warn(`レビューID取得警告: ${reviewSelectError.message}`);
    }

    console.log(`📊 関連レビュー数: ${reviewCount || 0}件 (取得データ: ${reviewIds?.length || 0}件)`);

    // 関連する品質ログを先に削除
    if (reviewIds && reviewIds.length > 0) {
      console.log(`🗑️ 品質ログ削除開始: ${reviewIds.length}件のレビューに関連`);
      
      const reviewIdList = reviewIds.map(r => r.id);
      console.log(`📝 削除対象レビューID: ${reviewIdList.slice(0, 5).join(', ')}${reviewIdList.length > 5 ? '...' : ''}`);
      
      const { error: qualityLogsError, count: deletedLogsCount } = await client
        .from(TABLES.QUALITY_LOGS)
        .delete({ count: 'exact' })
        .in('review_id', reviewIdList);

      if (qualityLogsError) {
        console.warn(`品質ログ削除警告: ${qualityLogsError.message} (Code: ${qualityLogsError.code})`);
      } else {
        console.log(`✅ 品質ログ削除完了: ${deletedLogsCount || 0}件`);
      }
    }

    // 関連するレビューを削除
    console.log(`🗑️ レビュー削除開始: バッチID ${batchId}`);
    const { error: reviewsError, count: deletedReviewsCount } = await client
      .from(TABLES.GENERATED_REVIEWS)
      .delete({ count: 'exact' })
      .eq('generation_batch_id', batchId);

    if (reviewsError) {
      throw new Error(`関連レビュー削除エラー: ${reviewsError.message} (Code: ${reviewsError.code})`);
    }

    console.log(`✅ レビュー削除完了: ${deletedReviewsCount || 0}件`);

    // バッチ自体を削除
    console.log(`🗑️ バッチ削除開始: ${batchId}`);
    const { error: batchError, count: deletedBatchCount } = await client
      .from(TABLES.GENERATION_BATCHES)
      .delete({ count: 'exact' })
      .eq('id', batchId);

    if (batchError) {
      throw new Error(`バッチ削除エラー: ${batchError.message} (Code: ${batchError.code})`);
    }

    if (deletedBatchCount === 0) {
      console.warn(`⚠️ バッチが削除されませんでした: ${batchId}`);
      
      // 再度存在確認
      const { data: stillExists } = await client
        .from(TABLES.GENERATION_BATCHES)
        .select('id')
        .eq('id', batchId)
        .single();
        
      if (stillExists) {
        throw new Error(`バッチ削除に失敗: ${batchId} がまだ存在しています`);
      }
    } else {
      console.log(`✅ バッチ削除完了: ${batchId} (削除件数: ${deletedBatchCount})`);
    }

    // 削除後の確認
    const { data: verifyBatch, error: verifyError } = await client
      .from(TABLES.GENERATION_BATCHES)
      .select('id')
      .eq('id', batchId)
      .single();

    if (verifyError && verifyError.code !== 'PGRST116') {
      console.warn(`削除確認エラー: ${verifyError.message}`);
    }

    if (verifyBatch) {
      throw new Error(`バッチ削除の確認に失敗: ${batchId} がまだ存在しています`);
    }

    console.log(`🎉 バッチ削除検証完了: ${batchId}`);
    
    // 最終的な統計情報
    console.log(`📈 削除統計:`, {
      batchId,
      batchName: batchExists.batch_name,
      deletedReviews: deletedReviewsCount || 0,
      deletedBatch: deletedBatchCount || 0
    });
    
  } catch (error) {
    console.error('❌ バッチ削除エラー:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};

/**
 * 複数の生成バッチを一括削除
 * @param {string[]} batchIds - 削除するバッチID一覧
 * @returns {Promise<{ success: number; failed: number; errors: string[] }>}
 */
export const deleteBatchesBulk = async (batchIds: string[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> => {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  console.log(`🗑️ 一括バッチ削除開始: ${batchIds.length}件`);
  console.log(`📝 削除対象バッチID: ${batchIds.join(', ')}`);

  for (const batchId of batchIds) {
    try {
      console.log(`🔄 バッチ削除処理中: ${batchId} (${result.success + result.failed + 1}/${batchIds.length})`);
      await deleteGenerationBatch(batchId);
      result.success++;
      console.log(`✅ バッチ削除成功: ${batchId}`);
    } catch (error) {
      result.failed++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`${batchId}: ${errorMessage}`);
      console.error(`❌ バッチ削除失敗: ${batchId} - ${errorMessage}`);
    }
  }

  console.log(`🎉 一括バッチ削除完了:`, {
    total: batchIds.length,
    success: result.success,
    failed: result.failed,
    errors: result.errors
  });
  
  return result;
};

/**
 * 全バッチを削除（管理者機能）
 * @returns {Promise<{ success: number; failed: number; errors: string[] }>}
 */
export const deleteAllBatches = async (): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> => {
  try {
    console.log('🗑️ 全バッチ削除開始');
    
    // 管理者権限クライアントを使用
    const client = supabaseAdmin || supabase;
    console.log(`🔑 使用クライアント: ${supabaseAdmin ? 'Admin' : 'Standard'}`);
    
    // 全バッチIDを取得
    const { data: allBatches, error: fetchError } = await client
      .from(TABLES.GENERATION_BATCHES)
      .select('id, batch_name')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw new Error(`全バッチ取得エラー: ${fetchError.message}`);
    }

    if (!allBatches || allBatches.length === 0) {
      console.log('📭 削除対象のバッチがありません');
      return { success: 0, failed: 0, errors: [] };
    }

    console.log(`📊 削除対象バッチ数: ${allBatches.length}件`);
    
    const batchIds = allBatches.map(batch => batch.id);
    return await deleteBatchesBulk(batchIds);
    
  } catch (error) {
    console.error('❌ 全バッチ削除エラー:', error);
    return {
      success: 0,
      failed: 1,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
};

/**
 * データベース統計情報を取得
 * @returns {Promise<any>} 統計情報
 */
export const getDatabaseStats = async (): Promise<any> => {
  try {
    const client = supabaseAdmin || supabase;
    
    // バッチ数
    const { count: batchCount } = await client
      .from(TABLES.GENERATION_BATCHES)
      .select('*', { count: 'exact', head: true });

    // レビュー数
    const { count: reviewCount } = await client
      .from(TABLES.GENERATED_REVIEWS)
      .select('*', { count: 'exact', head: true });

    // 品質ログ数
    const { count: qualityLogCount } = await client
      .from(TABLES.QUALITY_LOGS)
      .select('*', { count: 'exact', head: true });

    const stats = {
      batches: batchCount || 0,
      reviews: reviewCount || 0,
      qualityLogs: qualityLogCount || 0,
      timestamp: new Date().toISOString()
    };

    console.log('📊 データベース統計:', stats);
    return stats;
    
  } catch (error) {
    console.error('❌ 統計取得エラー:', error);
    return {
      batches: 0,
      reviews: 0,
      qualityLogs: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}; 