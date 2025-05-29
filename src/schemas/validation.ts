/**
 * 統一入力バリデーションスキーマ（Zod使用）
 * 
 * 概要:
 * - Zodを使用した型安全なバリデーション
 * - 全APIエンドポイントで使用する統一スキーマ
 * - 日本語エラーメッセージ対応
 * 
 * 主な機能:
 * - リクエストデータのバリデーション
 * - CSVデータのスキーマ検証
 * - 型推論による TypeScript 統合
 * - カスタムバリデーター
 */

import { z } from 'zod';

/**
 * カスタムエラーメッセージ（日本語）
 */
const errorMessages = {
  required: '必須項目です',
  invalid_type: '無効な形式です',
  too_small: '値が小さすぎます',
  too_big: '値が大きすぎます',
  invalid_string: '無効な文字列です',
  invalid_email: '有効なメールアドレスを入力してください',
  invalid_url: '有効なURLを入力してください',
  custom: '入力値が正しくありません',
} as const;

/**
 * 基本型スキーマ
 */
export const BaseSchemas = {
  // ID（UUID形式）
  id: z.string().uuid('有効なUUIDを入力してください'),
  
  // 非空文字列
  nonEmptyString: z.string().min(1, '1文字以上入力してください'),
  
  // 日本語対応文字列（1-1000文字）
  japaneseText: z.string().min(1, '1文字以上入力してください').max(1000, '1000文字以内で入力してください'),
  
  // 年齢（0-120歳）
  age: z.number().int('整数で入力してください').min(0, '0以上の値を入力してください').max(120, '120以下の値を入力してください'),
  
  // 評価（1-5星）
  rating: z.number().int('整数で入力してください').min(1, '1以上の値を入力してください').max(5, '5以下の値を入力してください'),
  
  // 品質スコア（0-10）
  qualityScore: z.number().min(0, '0以上の値を入力してください').max(10, '10以下の値を入力してください'),
  
  // 日時
  datetime: z.string().datetime('有効な日時形式で入力してください'),
  
  // ファイルサイズ（バイト）
  fileSize: z.number().int('整数で入力してください').min(0, '0以上の値を入力してください').max(100 * 1024 * 1024, 'ファイルサイズは100MB以下にしてください'),
} as const;

/**
 * 性別スキーマ
 */
export const GenderSchema = z.enum(['male', 'female', 'other', '男性', '女性', 'その他'], {
  errorMap: () => ({ message: '有効な性別を選択してください（male, female, other, 男性, 女性, その他）' })
});

/**
 * ファイルタイプスキーマ
 */
export const FileTypeSchema = z.enum(['basic_rules', 'human_patterns', 'qa_knowledge', 'success_examples'], {
  errorMap: () => ({ message: '有効なファイルタイプを選択してください' })
});

/**
 * バリデーション状態スキーマ
 */
export const ValidationStatusSchema = z.enum(['pending', 'valid', 'invalid'], {
  errorMap: () => ({ message: '有効なバリデーション状態を選択してください' })
});

/**
 * バッチ処理状態スキーマ
 */
export const BatchStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed'], {
  errorMap: () => ({ message: '有効なバッチ状態を選択してください' })
});

/**
 * レビューリクエストスキーマ
 */
export const ReviewRequestSchema = z.object({
  gender: GenderSchema,
  age: BaseSchemas.age.optional(),
  companion: BaseSchemas.nonEmptyString,
  word: BaseSchemas.japaneseText.optional(),
  recommend: BaseSchemas.japaneseText.optional(),
  business_type: BaseSchemas.japaneseText.optional(),
  vocabulary: BaseSchemas.japaneseText.optional(),
  target_length: z.number().int().min(1).max(10000).optional(),
  actual_length: z.number().int().min(0).optional(),
}).strict();

/**
 * 生成パラメータスキーマ
 */
export const GenerationParametersSchema = z.object({
  temperature: z.number().min(0, '0以上の値を入力してください').max(2, '2以下の値を入力してください'),
  maxTokens: z.number().int('整数で入力してください').min(1, '1以上の値を入力してください').max(100000, '100000以下の値を入力してください'),
  topP: z.number().min(0, '0以上の値を入力してください').max(1, '1以下の値を入力してください').optional(),
  frequencyPenalty: z.number().min(-2, '-2以上の値を入力してください').max(2, '2以下の値を入力してください').optional(),
  presencePenalty: z.number().min(-2, '-2以上の値を入力してください').max(2, '2以下の値を入力してください').optional(),
  timeout: z.number().int().min(1000, '1000ms以上の値を入力してください').max(300000, '300000ms以下の値を入力してください').optional(),
}).strict();

/**
 * アップロードファイルスキーマ
 */
export const UploadedFileSchema = z.object({
  id: BaseSchemas.id,
  name: BaseSchemas.nonEmptyString,
  size: BaseSchemas.fileSize,
  type: FileTypeSchema.optional(),
  lastModified: z.number().int().min(0).optional(),
}).strict();

/**
 * CSVファイル設定スキーマ
 */
export const CSVFileConfigSchema = z.object({
  uploadedFiles: z.array(UploadedFileSchema).min(1, '最低1つのファイルが必要です'),
  delimiter: z.string().max(5, '区切り文字は5文字以内で入力してください').default(','),
  encoding: z.enum(['utf-8', 'utf-16', 'shift_jis', 'euc-jp', 'iso-8859-1']).default('utf-8'),
  hasHeader: z.boolean().default(true),
}).strict();

/**
 * バッチ生成リクエストスキーマ
 */
export const BatchGenerationRequestSchema = z.object({
  csvConfig: CSVFileConfigSchema,
  generationParams: GenerationParametersSchema,
  batchSize: z.number().int('整数で入力してください').min(1, '1以上の値を入力してください').max(1000, '1000以下の値を入力してください'),
  batchCount: z.number().int('整数で入力してください').min(1, '1以上の値を入力してください').max(100, '100以下の値を入力してください'),
  batchName: z.string().max(100, '100文字以内で入力してください').optional(),
  customPrompt: z.string().max(10000, '10000文字以内で入力してください').optional(),
}).strict();

/**
 * CSV基本ルールスキーマ（サンプルCSV仕様対応）
 */
export const BasicRuleSchema = z.object({
  category: BaseSchemas.nonEmptyString,
  type: z.enum(['required', 'recommended', 'prohibited', 'format', 'key_point', 'area', 'business_type', 'usp', 'sub', 'environment', 'expression', 'main_feature', 'companion_mention', 'phrase'], {
    errorMap: () => ({ message: 'タイプは required, recommended, prohibited, format, key_point, area, business_type, usp, sub, environment, expression, main_feature, companion_mention, phrase のいずれかを選択してください' })
  }),
  content: BaseSchemas.japaneseText,
  priority: z.number().int().min(1).max(10).default(5).optional(),
  description: z.string().max(500).optional(),
}).strict();

/**
 * CSV人間パターンスキーマ（サンプルCSV仕様対応）
 */
export const HumanPatternSchema = z.object({
  age_group: z.enum(['10代', '20代', '30代', '40代', '50代', '60代以上'], {
    errorMap: () => ({ message: '有効な年齢層を選択してください' })
  }),
  gender: GenderSchema.optional(), // CSVでは未定義の場合がある
  personality_type: BaseSchemas.nonEmptyString,
  vocabulary: BaseSchemas.japaneseText,
  exclamation_marks: z.string().optional(), // 新規追加
  characteristics: z.string().optional(), // 新規追加
  example: z.string().optional(), // 新規追加
  // 既存フィールドをオプショナルに変更
  tone: BaseSchemas.nonEmptyString.optional(),
  example_phrases: z.array(z.string()).optional(),
}).strict();

/**
 * CSV QA知識スキーマ（サンプルCSV仕様対応）
 */
export const QAKnowledgeSchema = z.object({
  question: BaseSchemas.japaneseText,
  answer: BaseSchemas.japaneseText,
  category: BaseSchemas.nonEmptyString,
  priority: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'string') {
      // 文字列の優先度を数値に変換
      const priorityMap: Record<string, number> = {
        'Critical': 10,
        'High': 8,
        'Medium': 5,
        'Low': 2,
      };
      const mapped = priorityMap[val];
      if (mapped !== undefined) return mapped;
      
      // 数値文字列の場合
      const num = parseInt(val, 10);
      return isNaN(num) ? 5 : num; // デフォルト値5
    }
    return val;
  }).pipe(z.number().int().min(1).max(10)).optional(),
  // サンプルCSVの実際のフィールド
  example_situation: z.string().optional(),
  example_before: z.string().optional(),
  example_after: z.string().optional(),
  // 既存フィールドをオプショナルに
  keywords: z.array(z.string()).optional(),
  context: z.string().max(1000).optional(),
}).strict();

/**
 * CSV成功例スキーマ（サンプルCSV仕様対応）
 */
export const SuccessExampleSchema = z.object({
  review: BaseSchemas.japaneseText,
  age: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'string') {
      // "20代" -> 25, "30代" -> 35 のような変換
      const match = val.match(/(\d+)代/);
      if (match) {
        return parseInt(match[1], 10) + 5; // 代の中央値
      }
      const num = parseInt(val, 10);
      return isNaN(num) ? 25 : num; // デフォルト値
    }
    return val;
  }).pipe(BaseSchemas.age),
  gender: GenderSchema,
  companion: BaseSchemas.nonEmptyString,
  word: BaseSchemas.nonEmptyString,
  recommend: BaseSchemas.nonEmptyString,
  // 既存フィールドをオプショナルに
  rating: BaseSchemas.rating.optional(),
  category: BaseSchemas.nonEmptyString.optional(),
  quality_score: BaseSchemas.qualityScore.optional(),
  tags: z.array(z.string()).optional(),
}).strict();

/**
 * CSV設定スキーマ（統合）
 */
export const CSVConfigSchema = z.object({
  basicRules: z.array(BasicRuleSchema).min(1, '基本ルールは最低1つ必要です'),
  humanPatterns: z.array(HumanPatternSchema).min(1, '人間パターンは最低1つ必要です'),
  qaKnowledge: z.array(QAKnowledgeSchema).min(1, 'QA知識は最低1つ必要です'),
  successExamples: z.array(SuccessExampleSchema).min(1, '成功例は最低1つ必要です'),
}).strict();

/**
 * データベーステーブルスキーマ
 */
export const DatabaseSchemas = {
  csvFiles: z.object({
    id: BaseSchemas.id.optional(),
    file_name: BaseSchemas.nonEmptyString,
    file_type: FileTypeSchema,
    file_size: BaseSchemas.fileSize,
    upload_date: BaseSchemas.datetime.optional(),
    content_hash: BaseSchemas.nonEmptyString,
    row_count: z.number().int().min(0),
    column_count: z.number().int().min(0),
    validation_status: ValidationStatusSchema.default('pending'),
    validation_errors: z.any().optional(),
    created_at: BaseSchemas.datetime.optional(),
    updated_at: BaseSchemas.datetime.optional(),
  }).strict(),

  generatedReviews: z.object({
    id: BaseSchemas.id.optional(),
    review_text: BaseSchemas.japaneseText,
    rating: BaseSchemas.rating,
    reviewer_age: BaseSchemas.age.optional(),
    reviewer_gender: GenderSchema.optional(),
    quality_score: BaseSchemas.qualityScore.optional(),
    generation_prompt: z.string().optional(),
    generation_parameters: z.any().optional(),
    csv_file_ids: z.array(BaseSchemas.id),
    generation_batch_id: BaseSchemas.id.optional(),
    is_approved: z.boolean().default(false),
    created_at: BaseSchemas.datetime.optional(),
    updated_at: BaseSchemas.datetime.optional(),
  }).strict(),

  generationBatches: z.object({
    id: BaseSchemas.id.optional(),
    batch_name: z.string().max(100).optional(),
    total_count: z.number().int().min(0),
    completed_count: z.number().int().min(0).default(0),
    failed_count: z.number().int().min(0).default(0),
    status: BatchStatusSchema.default('pending'),
    generation_parameters: z.any(),
    csv_file_ids: z.array(BaseSchemas.id),
    start_time: BaseSchemas.datetime.optional(),
    end_time: BaseSchemas.datetime.optional(),
    error_message: z.string().optional(),
    created_at: BaseSchemas.datetime.optional(),
    updated_at: BaseSchemas.datetime.optional(),
  }).strict(),
} as const;

/**
 * API レスポンススキーマ
 */
export const ApiResponseSchemas = {
  success: z.object({
    success: z.literal(true),
    data: z.any(),
    message: z.string().optional(),
  }),

  error: z.object({
    success: z.literal(false),
    error: z.string(),
    code: z.string().optional(),
    details: z.any().optional(),
  }),

  validationError: z.object({
    success: z.literal(false),
    error: z.literal('Validation Error'),
    issues: z.array(z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
      code: z.string(),
    })),
  }),
} as const;

/**
 * 型推論用の型定義
 */
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;
export type GenerationParameters = z.infer<typeof GenerationParametersSchema>;
export type UploadedFile = z.infer<typeof UploadedFileSchema>;
export type CSVFileConfig = z.infer<typeof CSVFileConfigSchema>;
export type BatchGenerationRequest = z.infer<typeof BatchGenerationRequestSchema>;
export type BasicRule = z.infer<typeof BasicRuleSchema>;
export type HumanPattern = z.infer<typeof HumanPatternSchema>;
export type QAKnowledge = z.infer<typeof QAKnowledgeSchema>;
export type SuccessExample = z.infer<typeof SuccessExampleSchema>;
export type CSVConfig = z.infer<typeof CSVConfigSchema>;

/**
 * バリデーション実行ヘルパー関数
 */
export class ValidationHelper {
  /**
   * スキーマバリデーション実行
   */
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string; issues: z.ZodIssue[] } {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Validation Error',
          issues: error.issues,
        };
      }
      return {
        success: false,
        error: 'Unknown validation error',
        issues: [],
      };
    }
  }

  /**
   * 安全な型変換（パースエラーを含む）
   */
  static safeParse<T>(schema: z.ZodSchema<T>, data: unknown): z.SafeParseReturnType<unknown, T> {
    return schema.safeParse(data);
  }

  /**
   * 部分的バリデーション（一部のフィールドのみ）
   */
  static validatePartial<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: Partial<T> } | { success: false; error: string; issues: z.ZodIssue[] } {
    try {
      // ZodObjectの場合のみpartialメソッドを使用
      const partialSchema = (schema as any).partial ? (schema as any).partial() : schema;
      const result = partialSchema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Validation Error',
          issues: error.issues,
        };
      }
      return {
        success: false,
        error: 'Unknown validation error',
        issues: [],
      };
    }
  }

  /**
   * バリデーションエラーの日本語フォーマット
   */
  static formatErrorMessages(issues: z.ZodIssue[]): string[] {
    return issues.map(issue => {
      const path = issue.path.join('.');
      const field = path || 'ルート';
      return `${field}: ${issue.message}`;
    });
  }

  /**
   * APIレスポンス形式での検証結果返却
   */
  static createValidationResponse<T>(schema: z.ZodSchema<T>, data: unknown) {
    const result = this.validate(schema, data);
    
    if (result.success) {
      return {
        success: true as const,
        data: result.data,
      };
    } else {
      return {
        success: false as const,
        error: 'Validation Error' as const,
        issues: result.issues.map(issue => ({
          path: issue.path,
          message: issue.message,
          code: issue.code,
        })),
      };
    }
  }
}

/**
 * カスタムバリデーター
 */
export const CustomValidators = {
  /**
   * HTMLタグ検出バリデーター
   */
  noHtmlTags: z.string().refine(
    (val) => !/<[^>]*>/g.test(val),
    { message: 'HTMLタグは使用できません' }
  ),

  /**
   * 日本語文字検証
   */
  containsJapanese: z.string().refine(
    (val) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(val),
    { message: '日本語文字を含む必要があります' }
  ),

  /**
   * CSVファイル拡張子検証
   */
  csvFileExtension: z.string().refine(
    (filename) => /\.(csv|txt|tsv)$/i.test(filename),
    { message: 'CSVファイル（.csv, .txt, .tsv）のみアップロード可能です' }
  ),

  /**
   * 安全なファイル名検証
   */
  safeFilename: z.string().refine(
    (filename) => !/[<>:"/\\|?*]/.test(filename),
    { message: 'ファイル名に使用できない文字が含まれています' }
  ),
} as const;