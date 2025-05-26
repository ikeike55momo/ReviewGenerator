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
 * 既存のレビューテキストを全て取得（重複チェック用）
 * @param {number} limit - 取得件数制限（デフォルト: 1000）
 * @returns {Promise<string[]>} 既存レビューテキスト一覧
 */
export const getExistingReviews = async (limit: number = 1000): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.GENERATED_REVIEWS)
      .select('review_text')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`既存レビュー取得エラー: ${error.message}`);
    }

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
    
    // 関連するレビューを先に削除
    const { error: reviewsError } = await supabase
      .from(TABLES.GENERATED_REVIEWS)
      .delete()
      .eq('generation_batch_id', batchId);

    if (reviewsError) {
      throw new Error(`関連レビュー削除エラー: ${reviewsError.message}`);
    }

    // 関連する品質ログを削除（まず関連するレビューIDを取得）
    const { data: reviewIds } = await supabase
      .from(TABLES.GENERATED_REVIEWS)
      .select('id')
      .eq('generation_batch_id', batchId);

    if (reviewIds && reviewIds.length > 0) {
      const { error: qualityLogsError } = await supabase
        .from(TABLES.QUALITY_LOGS)
        .delete()
        .in('review_id', reviewIds.map(r => r.id));

      // 品質ログの削除エラーは警告レベル
      if (qualityLogsError) {
        console.warn(`品質ログ削除警告: ${qualityLogsError.message}`);
      }
    }

    // バッチ自体を削除
    const { error: batchError } = await supabase
      .from(TABLES.GENERATION_BATCHES)
      .delete()
      .eq('id', batchId);

    if (batchError) {
      throw new Error(`バッチ削除エラー: ${batchError.message}`);
    }

    console.log(`✅ バッチ削除完了: ${batchId}`);
  } catch (error) {
    console.error('バッチ削除エラー:', error);
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

  for (const batchId of batchIds) {
    try {
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

  console.log(`🎉 一括バッチ削除完了: 成功${result.success}件, 失敗${result.failed}件`);
  return result;
}; 