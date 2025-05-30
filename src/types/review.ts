/**
 * レビュー関連の型定義
 * 
 * 概要:
 * - レビュー生成リクエスト・レスポンス用の型定義
 * - データベース連携対応
 * - バッチ管理機能対応
 * 
 * 主な型:
 * - ReviewRequest: レビュー生成リクエスト
 * - GeneratedReview: 生成されたレビューデータ
 * - GenerationBatch: バッチ管理情報
 * 
 * 制限事項:
 * - データベーススキーマと一致させる必要がある
 */

/**
 * 生成パラメータ型定義
 */
export interface GenerationParameters {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    model?: string;
    timeout?: number;
    
    // レビュー生成時の追加パラメータ
    selectedPattern?: any;
    selectedElements?: any;
    targetLength?: number;
    customPrompt?: string;
    usedWords?: string[];
    selectedRecommendation?: string;
    mode?: string; // API エンドポイントの動作モード
    timestamp?: string; // 生成時刻
    seed?: number; // 生成シード値
    
    // API特有のパラメータ
    selectedAge?: string;
    selectedPersonality?: string;
    selectedArea?: string;
    selectedBusinessType?: string;
    selectedUSP?: string;
    index?: number;
    
    // 品質管理用パラメータ
    qualityBreakdown?: {
        basic?: any;
        qaKnowledge?: any;
        overall?: any;
    };
    
    // エラー処理用
    error?: boolean;
    error_message?: string;
}

/**
 * CSV ファイル設定型定義（レガシー）
 * @deprecated Use CSVDataConfig from csv.ts instead
 */
export interface CSVFileConfig {
    uploadedFiles: UploadedFile[];
    delimiter?: string;
    encoding?: string;
    skipEmptyLines?: boolean;
    headers?: string[];
}

/**
 * アップロードファイル型定義
 */
export interface UploadedFile {
    id: string;
    name: string;
    size: number;
    type: string;
    content?: string;
    lastModified?: number;
}

export interface ReviewRequest {
    age_group?: string;
    age?: string;
    gender: string;
    companion: string;
    personality_type?: string;
    word?: string;
    recommend?: string;
    business_type?: string;
    target_length?: number;
    actual_length?: number;
    generated_at?: string;
    ai_generated?: boolean;
    prompt_length?: number;
    vocabulary?: string;
    exclamation_marks?: string;
    error?: boolean;
    error_message?: string;
}

/**
 * 生成されたレビュー情報（データベース連携対応）
 */
export interface GeneratedReview {
    id?: string;
    reviewText: string;
    rating: number;
    reviewerAge: number;
    reviewerGender: 'male' | 'female' | 'other';
    qualityScore: number;
    generationPrompt?: string;
    generationParameters?: GenerationParameters;
    csvFileIds: string[];
    generationBatchId?: string;
    isApproved?: boolean;
    createdAt?: string;
    updatedAt?: string;
    
    // CSV出力用フィールド
    companion?: string;  // 同伴者情報（一人、パートナー、友人等）
    word?: string;       // 文体タイプ（High型、Medium型、Low型等）
    recommend?: string;  // 推奨フレーズ（日本酒好きに、二次会に等）
}

/**
 * レビュー生成バッチ情報
 */
export interface GenerationBatch {
    id?: string;
    batchName?: string;
    totalCount: number;
    completedCount: number;
    failedCount: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    generationParameters: GenerationParameters;
    csvFileIds: string[];
    startTime?: string;
    endTime?: string;
    errorMessage?: string;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * バッチ生成リクエスト
 */
export interface BatchGenerationRequest {
    csvConfig: CSVFileConfig;
    batchSize: number;
    batchCount: number;
    customPrompt?: string;
    batchName?: string;
}

/**
 * レガシー型（後方互換性のため保持）
 */
export interface LegacyGeneratedReview {
    text: string;
    score: number;
    metadata: ReviewRequest;
}
