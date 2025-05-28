/**
 * バリデーション関数集
 * 
 * 概要:
 * - 入力データの検証とサニタイゼーション
 * - 型安全性の確保
 * - エラーハンドリングの統一
 * 
 * 主な機能:
 * - レビューリクエストのバリデーション
 * - CSV データのバリデーション
 * - API パラメータのバリデーション
 */

import { ReviewRequest, GenerationParameters, CSVConfig, UploadedFile, BatchGenerationRequest } from '../types/review';
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
 * レビューリクエストのバリデーション
 */
export function validateReviewRequest(request: ReviewRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必須フィールドの検証
    if (!request.gender || request.gender.trim() === '') {
        errors.push('Gender is required');
    }

    if (!request.companion || request.companion.trim() === '') {
        errors.push('Companion information is required');
    }

    // gender の値の検証
    const validGenders = ['male', 'female', 'other', '男性', '女性', 'その他'];
    if (request.gender && !validGenders.includes(request.gender.toLowerCase())) {
        errors.push(`Invalid gender value: ${request.gender}. Must be one of: ${validGenders.join(', ')}`);
    }

    // age の検証
    if (request.age) {
        const ageNum = parseInt(request.age, 10);
        if (isNaN(ageNum) || ageNum < 0 || ageNum > 120) {
            errors.push('Age must be a valid number between 0 and 120');
        }
    }

    // target_length の検証
    if (request.target_length !== undefined) {
        if (typeof request.target_length !== 'number' || request.target_length < 1 || request.target_length > 10000) {
            errors.push('Target length must be a number between 1 and 10000');
        }
    }

    // actual_length の検証
    if (request.actual_length !== undefined) {
        if (typeof request.actual_length !== 'number' || request.actual_length < 0) {
            errors.push('Actual length must be a non-negative number');
        }
    }

    // XSS 対策: HTMLタグの検出
    const htmlTagRegex = /<[^>]*>/g;
    const textFields = [request.word, request.recommend, request.business_type, request.vocabulary];
    textFields.forEach((field, index) => {
        if (field && htmlTagRegex.test(field)) {
            warnings.push(`Potential HTML content detected in field ${index + 1}. Content will be sanitized.`);
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * 生成パラメータのバリデーション
 */
export function validateGenerationParameters(params: GenerationParameters): ValidationResult {
    const errors: string[] = [];

    // temperature の検証
    if (typeof params.temperature !== 'number' || params.temperature < 0 || params.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2');
    }

    // maxTokens の検証
    if (typeof params.maxTokens !== 'number' || params.maxTokens < 1 || params.maxTokens > 100000) {
        errors.push('MaxTokens must be a number between 1 and 100000');
    }

    // topP の検証
    if (params.topP !== undefined && (typeof params.topP !== 'number' || params.topP < 0 || params.topP > 1)) {
        errors.push('TopP must be a number between 0 and 1');
    }

    // frequencyPenalty の検証
    if (params.frequencyPenalty !== undefined && (typeof params.frequencyPenalty !== 'number' || params.frequencyPenalty < -2 || params.frequencyPenalty > 2)) {
        errors.push('FrequencyPenalty must be a number between -2 and 2');
    }

    // presencePenalty の検証
    if (params.presencePenalty !== undefined && (typeof params.presencePenalty !== 'number' || params.presencePenalty < -2 || params.presencePenalty > 2)) {
        errors.push('PresencePenalty must be a number between -2 and 2');
    }

    // timeout の検証
    if (params.timeout !== undefined && (typeof params.timeout !== 'number' || params.timeout < 1000 || params.timeout > 300000)) {
        errors.push('Timeout must be a number between 1000 and 300000 milliseconds');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * CSV データ設定のバリデーション（csv.ts型用）
 */
export function validateCSVDataConfig(config: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 設定が存在するかチェック
    if (!config || typeof config !== 'object') {
        errors.push('CSV configuration object is required');
        return { isValid: false, errors };
    }

    // basicRules の検証
    if (!config.basicRules || !Array.isArray(config.basicRules)) {
        errors.push('Basic rules data is required and must be an array');
    } else if (config.basicRules.length === 0) {
        warnings.push('Basic rules array is empty');
    } else {
        config.basicRules.forEach((rule: any, index: number) => {
            if (!rule || typeof rule !== 'object') {
                errors.push(`Basic rule ${index + 1}: must be an object`);
            } else if (!rule.category || !rule.type || !rule.content) {
                errors.push(`Basic rule ${index + 1}: category, type, and content are required`);
            }
        });
    }

    // humanPatterns の検証
    if (!config.humanPatterns || !Array.isArray(config.humanPatterns)) {
        errors.push('Human patterns data is required and must be an array');
    } else if (config.humanPatterns.length === 0) {
        warnings.push('Human patterns array is empty');
    } else {
        config.humanPatterns.forEach((pattern: any, index: number) => {
            if (!pattern || typeof pattern !== 'object') {
                errors.push(`Human pattern ${index + 1}: must be an object`);
            } else if (!pattern.age_group || !pattern.personality_type || !pattern.vocabulary) {
                errors.push(`Human pattern ${index + 1}: age_group, personality_type, and vocabulary are required`);
            }
        });
    }

    // qaKnowledge の検証
    if (!config.qaKnowledge || !Array.isArray(config.qaKnowledge)) {
        errors.push('QA knowledge data is required and must be an array');
    } else if (config.qaKnowledge.length === 0) {
        warnings.push('QA knowledge array is empty');
    } else {
        config.qaKnowledge.forEach((qa: any, index: number) => {
            if (!qa || typeof qa !== 'object') {
                errors.push(`QA knowledge ${index + 1}: must be an object`);
            } else if (!qa.question || !qa.answer || !qa.category) {
                errors.push(`QA knowledge ${index + 1}: question, answer, and category are required`);
            }
        });
    }

    // successExamples の検証
    if (!config.successExamples || !Array.isArray(config.successExamples)) {
        errors.push('Success examples data is required and must be an array');
    } else if (config.successExamples.length === 0) {
        warnings.push('Success examples array is empty');
    } else {
        config.successExamples.forEach((example: any, index: number) => {
            if (!example || typeof example !== 'object') {
                errors.push(`Success example ${index + 1}: must be an object`);
            } else if (!example.review || !example.age || !example.gender) {
                errors.push(`Success example ${index + 1}: review, age, and gender are required`);
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * CSV 設定のバリデーション（review.ts型用、レガシー）
 */
export function validateCSVConfig(config: CSVConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // uploadedFiles の検証
    if (!config.uploadedFiles || !Array.isArray(config.uploadedFiles) || config.uploadedFiles.length === 0) {
        errors.push('At least one uploaded file is required');
    } else {
        config.uploadedFiles.forEach((file, index) => {
            const fileErrors = validateUploadedFile(file);
            if (!fileErrors.isValid) {
                errors.push(`File ${index + 1}: ${fileErrors.errors.join(', ')}`);
            }
        });
    }

    // delimiter の検証
    if (config.delimiter && config.delimiter.length > 5) {
        warnings.push('Delimiter is unusually long. Common delimiters are single characters like "," or ";"');
    }

    // encoding の検証
    const validEncodings = ['utf-8', 'utf-16', 'shift_jis', 'euc-jp', 'iso-8859-1'];
    if (config.encoding && !validEncodings.includes(config.encoding.toLowerCase())) {
        warnings.push(`Encoding "${config.encoding}" might not be supported. Recommended: ${validEncodings.join(', ')}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * アップロードファイルのバリデーション
 */
export function validateUploadedFile(file: UploadedFile): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必須フィールドの検証
    if (!file.id || file.id.trim() === '') {
        errors.push('File ID is required');
    }

    if (!file.name || file.name.trim() === '') {
        errors.push('File name is required');
    }

    if (typeof file.size !== 'number' || file.size < 0) {
        errors.push('File size must be a non-negative number');
    }

    // ファイルサイズの警告
    const maxSizeWarning = 10 * 1024 * 1024; // 10MB
    const maxSizeError = 100 * 1024 * 1024; // 100MB
    
    if (file.size > maxSizeError) {
        errors.push(`File size (${formatFileSize(file.size)}) exceeds maximum limit (${formatFileSize(maxSizeError)})`);
    } else if (file.size > maxSizeWarning) {
        warnings.push(`File size (${formatFileSize(file.size)}) is large and may impact performance`);
    }

    // ファイル拡張子の検証
    if (file.name) {
        const extension = file.name.toLowerCase().split('.').pop();
        const validExtensions = ['csv', 'txt', 'tsv'];
        if (extension && !validExtensions.includes(extension)) {
            warnings.push(`File extension ".${extension}" might not be a valid CSV file`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}

/**
 * バッチ生成リクエストのバリデーション
 */
export function validateBatchGenerationRequest(request: BatchGenerationRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // CSV設定の検証
    const csvValidation = validateCSVConfig(request.csvConfig);
    if (!csvValidation.isValid) {
        errors.push(...csvValidation.errors.map(err => `CSV Config: ${err}`));
    }
    if (csvValidation.warnings) {
        warnings.push(...csvValidation.warnings.map(warn => `CSV Config: ${warn}`));
    }

    // batchSize の検証
    if (typeof request.batchSize !== 'number' || request.batchSize < 1 || request.batchSize > 1000) {
        errors.push('Batch size must be a number between 1 and 1000');
    }

    // batchCount の検証
    if (typeof request.batchCount !== 'number' || request.batchCount < 1 || request.batchCount > 100) {
        errors.push('Batch count must be a number between 1 and 100');
    }

    // 総生成数の警告
    const totalItems = request.batchSize * request.batchCount;
    if (totalItems > 10000) {
        warnings.push(`Total items to generate (${totalItems}) is very large and may take a long time`);
    }

    // batchName の検証
    if (request.batchName && request.batchName.length > 100) {
        errors.push('Batch name must not exceed 100 characters');
    }

    // customPrompt の検証
    if (request.customPrompt && request.customPrompt.length > 10000) {
        warnings.push('Custom prompt is very long and may impact performance');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
    };
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