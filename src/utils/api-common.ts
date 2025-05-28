/**
 * API 共通ユーティリティ
 * 
 * 概要:
 * - 複数のAPIエンドポイントで共通して使用される機能
 * - エラーハンドリングの標準化
 * - レスポンス形式の統一
 * - バリデーション処理の共通化
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { validateReviewRequest, validateGenerationParameters, ValidationResult } from './validators';
import { ReviewRequest, GenerationParameters } from '../types/review';

/**
 * 標準APIレスポンス型（型安全性改善）
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
    processingTime?: number;
  };
}

/**
 * APIエラーコード定数
 */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_PARAMETER: 'MISSING_PARAMETER'
} as const;

/**
 * HTTPステータスコード定数
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * 成功レスポンスを生成
 */
export function createSuccessResponse<T>(
  data: T,
  metadata?: Partial<ApiResponse['metadata']>
): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * エラーレスポンスを生成
 */
export function createErrorResponse(
  code: keyof typeof API_ERROR_CODES,
  message: string,
  details?: any,
  metadata?: Partial<ApiResponse['metadata']>
): ApiResponse {
  return {
    success: false,
    error: {
      code: API_ERROR_CODES[code],
      message,
      details
    },
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * APIエンドポイントの共通ラッパー
 */
export function withApiHandler<T = any>(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<T>,
  options: {
    allowedMethods?: string[];
    requireAuth?: boolean;
    rateLimit?: {
      requests: number;
      window: number; // seconds
    };
  } = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const startTime = Date.now();
    const requestId = generateRequestId();

    try {
      // HTTP メソッドチェック
      if (options.allowedMethods && !options.allowedMethods.includes(req.method || '')) {
        return sendResponse(res, HTTP_STATUS.METHOD_NOT_ALLOWED, 
          createErrorResponse('INVALID_REQUEST', `Method ${req.method} not allowed`, {
            allowedMethods: options.allowedMethods
          }, { requestId })
        );
      }

      // 認証チェック（実装が必要な場合）
      if (options.requireAuth) {
        // TODO: 認証ロジックを実装
      }

      // レート制限チェック（実装が必要な場合）
      if (options.rateLimit) {
        // TODO: レート制限ロジックを実装
      }

      // ハンドラー実行
      const result = await handler(req, res);
      
      // 成功レスポンス（ハンドラーが直接レスポンスを送信していない場合）
      if (!res.headersSent && result !== undefined) {
        const processingTime = Date.now() - startTime;
        return sendResponse(res, HTTP_STATUS.OK, 
          createSuccessResponse(result, { requestId, processingTime })
        );
      }

    } catch (error) {
      console.error('🚨 API Handler Error:', error);
      
      if (!res.headersSent) {
        const processingTime = Date.now() - startTime;
        return sendResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR,
          createErrorResponse('INTERNAL_ERROR', 'Internal server error', 
            process.env.NODE_ENV === 'development' ? error : undefined,
            { requestId, processingTime }
          )
        );
      }
    }
  };
}

/**
 * レスポンスを送信
 */
export function sendResponse(
  res: NextApiResponse,
  status: number,
  data: ApiResponse
): void {
  res.status(status).json(data);
}

/**
 * リクエストIDを生成
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * リクエストボディの基本バリデーション
 */
export function validateRequestBody(
  body: any,
  requiredFields: string[]
): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    errors.push('Request body must be a valid JSON object');
    return { isValid: false, errors };
  }

  requiredFields.forEach(field => {
    if (!(field in body) || body[field] === undefined || body[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * リクエストパラメータの型変換とバリデーション
 */
export function parseAndValidateParams(req: NextApiRequest): {
  reviewCount?: number;
  batchSize?: number;
  batchCount?: number;
  saveToDB?: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const result: any = {};

  // reviewCount のパース
  if (req.body.reviewCount !== undefined) {
    const parsed = parseInt(req.body.reviewCount, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
      errors.push('reviewCount must be a number between 1 and 1000');
    } else {
      result.reviewCount = parsed;
    }
  }

  // batchSize のパース
  if (req.body.batchSize !== undefined) {
    const parsed = parseInt(req.body.batchSize, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
      errors.push('batchSize must be a number between 1 and 1000');
    } else {
      result.batchSize = parsed;
    }
  }

  // batchCount のパース
  if (req.body.batchCount !== undefined) {
    const parsed = parseInt(req.body.batchCount, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      errors.push('batchCount must be a number between 1 and 100');
    } else {
      result.batchCount = parsed;
    }
  }

  // saveToDB のパース
  if (req.body.saveToDB !== undefined) {
    result.saveToDB = Boolean(req.body.saveToDB);
  }

  return { ...result, errors };
}

/**
 * 生成パラメータのデフォルト値設定
 */
export function getDefaultGenerationParameters(): GenerationParameters {
  return {
    temperature: 0.95,
    maxTokens: 1000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    model: 'claude-3-5-sonnet-20241022',
    timeout: 45000
  };
}

/**
 * APIレート制限チェック（メモリベース、本格運用時はRedis等を使用）
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  requests: number = 100,
  windowSeconds: number = 3600
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    // 新しいウィンドウまたは期限切れ
    const newEntry = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitMap.set(identifier, newEntry);
    
    return {
      allowed: true,
      remaining: requests - 1,
      resetTime: newEntry.resetTime
    };
  }

  if (entry.count >= requests) {
    // レート制限に引っかかった
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }

  // カウント増加
  entry.count++;
  rateLimitMap.set(identifier, entry);

  return {
    allowed: true,
    remaining: requests - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Content-Type チェック
 */
export function validateContentType(req: NextApiRequest): boolean {
  const contentType = req.headers['content-type'];
  return contentType?.includes('application/json') ?? false;
}

/**
 * CORS ヘッダーを設定
 */
export function setCorsHeaders(res: NextApiResponse, allowedOrigins: string[] = ['*']): void {
  const origin = allowedOrigins.includes('*') ? '*' : allowedOrigins[0];
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * データベース接続エラーハンドリング
 */
export function handleDatabaseError(error: any): ApiResponse {
  console.error('🚨 Database Error:', error);
  
  if (error.message?.includes('connection')) {
    return createErrorResponse('SERVICE_UNAVAILABLE', 'Database connection failed');
  }
  
  if (error.message?.includes('timeout')) {
    return createErrorResponse('TIMEOUT', 'Database operation timeout');
  }
  
  return createErrorResponse('INTERNAL_ERROR', 'Database operation failed');
}

/**
 * AI サービスエラーハンドリング
 */
export function handleAIServiceError(error: any): ApiResponse {
  console.error('🚨 AI Service Error:', error);
  
  if (error.status === 401) {
    return createErrorResponse('UNAUTHORIZED', 'AI service authentication failed');
  }
  
  if (error.status === 429) {
    return createErrorResponse('RATE_LIMIT', 'AI service rate limit exceeded');
  }
  
  if (error.status === 503) {
    return createErrorResponse('SERVICE_UNAVAILABLE', 'AI service temporarily unavailable');
  }
  
  return createErrorResponse('INTERNAL_ERROR', 'AI service request failed');
}

/**
 * 入力サニタイゼーション（改善版）
 */
export function sanitizeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // script tags
      .replace(/<[^>]*>/g, '') // HTML tags
      .replace(/javascript:/gi, '') // javascript: URLs
      .replace(/on\w+\s*=/gi, '') // event handlers
      .replace(/data:/gi, '') // data URLs
      .trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object' && input !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * ログ出力のための安全な文字列化
 */
export function safeStringify(obj: any, maxLength: number = 1000): string {
  try {
    const str = JSON.stringify(obj, null, 2);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  } catch (error) {
    return '[Circular or Invalid Object]';
  }
}