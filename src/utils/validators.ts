/**
 * バリデーション関数集（Zodスキーマ統合版）
 * 
 * 概要:
 * - 入力データの検証とサニタイゼーション
 * - Zodスキーマを使用した型安全性の確保
 * - エラーハンドリングの統一
 * 
 * 主な機能:
 * - レビューリクエストのバリデーション
 * - CSV データのバリデーション
 * - API パラメータのバリデーション
 * - 統一されたZodスキーマの使用
 */

import { 
  ReviewRequestSchema, 
  GenerationParametersSchema, 
  CSVFileConfigSchema, 
  UploadedFileSchema, 
  BatchGenerationRequestSchema,
  CSVConfigSchema,
  ValidationHelper,
  type ReviewRequest, 
  type GenerationParameters, 
  type CSVFileConfig, 
  type UploadedFile, 
  type BatchGenerationRequest 
} from '../schemas/validation';
import { CSVConfig as CSVDataConfig, BasicRule, HumanPattern, QAKnowledge, SuccessExample } from '../types/csv';

/**
 * バリデーション結果型
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}

/**
 * 数値範囲バリデーション設定
 */
export interface NumberRange {
    min?: number;
    max?: number;
}

/**
 * 文字列長バリデーション設定
 */
export interface StringLengthRange {
    min?: number;
    max?: number;
}

/**
 * レビューリクエストのバリデーション（Zodスキーマ使用）
 */
export function validateReviewRequest(request: unknown): ValidationResult {
    const result = ValidationHelper.validate(ReviewRequestSchema, request);
    
    if (result.success) {
        // 追加のビジネスロジック検証
        const warnings: string[] = [];
        const data = result.data;
        
        // XSS 対策: HTMLタグの検出
        const htmlTagRegex = /<[^>]*>/g;
        const textFields = [data.word, data.recommend, data.business_type, data.vocabulary];
        textFields.forEach((field, index) => {
            if (field && htmlTagRegex.test(field)) {
                warnings.push(`フィールド ${index + 1} にHTMLコンテンツが検出されました。サニタイズされます。`);
            }
        });
        
        return {
            isValid: true,
            errors: [],
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } else {
        return {
            isValid: false,
            errors: ValidationHelper.formatErrorMessages(result.issues),
        };
    }
}

/**
 * 生成パラメータのバリデーション（Zodスキーマ使用）
 */
export function validateGenerationParameters(params: unknown): ValidationResult {
    const result = ValidationHelper.validate(GenerationParametersSchema, params);
    
    if (result.success) {
        return {
            isValid: true,
            errors: [],
        };
    } else {
        return {
            isValid: false,
            errors: ValidationHelper.formatErrorMessages(result.issues),
        };
    }
}

/**
 * CSV データ設定のバリデーション（Zodスキーマ使用）
 */
export function validateCSVDataConfig(config: unknown): ValidationResult {
    const result = ValidationHelper.validate(CSVConfigSchema, config);
    
    if (result.success) {
        const warnings: string[] = [];
        const data = result.data;
        
        // 追加の警告チェック
        if (data.basicRules.length === 0) {
            warnings.push('基本ルールが空です');
        }
        if (data.humanPatterns.length === 0) {
            warnings.push('人間パターンが空です');
        }
        if (data.qaKnowledge.length === 0) {
            warnings.push('QA知識が空です');
        }
        if (data.successExamples.length === 0) {
            warnings.push('成功例が空です');
        }
        
        return {
            isValid: true,
            errors: [],
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } else {
        return {
            isValid: false,
            errors: ValidationHelper.formatErrorMessages(result.issues),
        };
    }
}

/**
 * CSV 設定のバリデーション（Zodスキーマ使用）
 */
export function validateCSVFileConfig(config: unknown): ValidationResult {
    const result = ValidationHelper.validate(CSVFileConfigSchema, config);
    
    if (result.success) {
        const warnings: string[] = [];
        const data = result.data;
        
        // delimiter の追加検証
        if (data.delimiter && data.delimiter.length > 5) {
            warnings.push('区切り文字が異常に長いです。通常は "," や ";" などの単一文字を使用します');
        }
        
        return {
            isValid: true,
            errors: [],
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } else {
        return {
            isValid: false,
            errors: ValidationHelper.formatErrorMessages(result.issues),
        };
    }
}

/**
 * アップロードファイルのバリデーション（Zodスキーマ使用）
 */
export function validateUploadedFile(file: unknown): ValidationResult {
    const result = ValidationHelper.validate(UploadedFileSchema, file);
    
    if (result.success) {
        const warnings: string[] = [];
        const data = result.data;
        
        // ファイルサイズの警告
        const maxSizeWarning = 10 * 1024 * 1024; // 10MB
        
        if (data.size > maxSizeWarning) {
            warnings.push(`ファイルサイズ (${formatFileSize(data.size)}) が大きく、パフォーマンスに影響する可能性があります`);
        }

        // ファイル拡張子の検証
        const extension = data.name.toLowerCase().split('.').pop();
        const validExtensions = ['csv', 'txt', 'tsv'];
        if (extension && !validExtensions.includes(extension)) {
            warnings.push(`ファイル拡張子 ".${extension}" は有効なCSVファイルではない可能性があります`);
        }
        
        return {
            isValid: true,
            errors: [],
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } else {
        return {
            isValid: false,
            errors: ValidationHelper.formatErrorMessages(result.issues),
        };
    }
}

/**
 * バッチ生成リクエストのバリデーション（Zodスキーマ使用）
 */
export function validateBatchGenerationRequest(request: unknown): ValidationResult {
    const result = ValidationHelper.validate(BatchGenerationRequestSchema, request);
    
    if (result.success) {
        const warnings: string[] = [];
        const data = result.data;
        
        // 総生成数の警告
        const totalItems = data.batchSize * data.batchCount;
        if (totalItems > 10000) {
            warnings.push(`総生成数 (${totalItems}) が非常に多く、時間がかかる可能性があります`);
        }

        // カスタムプロンプトの警告
        if (data.customPrompt && data.customPrompt.length > 5000) {
            warnings.push('カスタムプロンプトが非常に長く、パフォーマンスに影響する可能性があります');
        }
        
        return {
            isValid: true,
            errors: [],
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } else {
        return {
            isValid: false,
            errors: ValidationHelper.formatErrorMessages(result.issues),
        };
    }
}

/**
 * 文字列の長さバリデーション
 */
export function validateStringLength(value: string, range: StringLengthRange, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (range.min !== undefined && value.length < range.min) {
        errors.push(`${fieldName} must be at least ${range.min} characters`);
    }

    if (range.max !== undefined && value.length > range.max) {
        errors.push(`${fieldName} must not exceed ${range.max} characters`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * 数値範囲バリデーション
 */
export function validateNumberRange(value: number, range: NumberRange, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (range.min !== undefined && value < range.min) {
        errors.push(`${fieldName} must be at least ${range.min}`);
    }

    if (range.max !== undefined && value > range.max) {
        errors.push(`${fieldName} must not exceed ${range.max}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * HTMLサニタイゼーション
 */
export function sanitizeHtml(input: string): string {
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * SQL インジェクション対策のための文字列エスケープ
 */
export function escapeSqlString(input: string): string {
    return input.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

/**
 * ファイルサイズのフォーマット
 */
function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 複数のバリデーション結果をマージ
 */
export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    results.forEach(result => {
        allErrors.push(...result.errors);
        if (result.warnings) {
            allWarnings.push(...result.warnings);
        }
    });

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings.length > 0 ? allWarnings : undefined
    };
}