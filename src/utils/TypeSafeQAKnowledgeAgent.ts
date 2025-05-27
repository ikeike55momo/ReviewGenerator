/**
 * @file TypeSafeQAKnowledgeAgent.ts
 * @description 強化された型安全性とエラーハンドリングシステム
 * 主な機能：Result型パターン、カスタムエラー型、型安全なQAナレッジエージェント
 * 制限事項：any型の使用を最小限に抑制、包括的な型検証とエラーハンドリング
 */

// ========================================
// 型定義の強化
// ========================================

interface QAKnowledgeEntry {
  question: string;
  answer: string;
  category: QACategory;
  priority: QAPriority;
  example_situation?: string;
  example_before?: string;
  example_after?: string;
  created_date?: string;
  effectiveness_score?: number;
}

type QACategory = 
  | '表現問題' 
  | '内容問題' 
  | '構造問題' 
  | '規制問題' 
  | '業界固有問題'
  | '文脈依存'
  | 'その他';

type QAPriority = 'Critical' | 'High' | 'Medium' | 'Low';

interface QualityCheckResult {
  passed: boolean;
  score: number;
  violations: QualityViolation[];
  recommendations: string[];
  metadata: QualityCheckMetadata;
}

interface QualityViolation {
  id: string;
  type: string;
  description: string;
  severity: ViolationSeverity;
  confidence: number;
  relatedQA?: string;
  detectionMethod: DetectionMethod;
  suggestedFix?: string;
  context?: ViolationContext;
}

type ViolationSeverity = '致命的' | '高' | '中' | '低';
type DetectionMethod = 'exact' | 'partial' | 'pattern' | 'semantic' | 'contextual';

interface ViolationContext {
  position: { start: number; end: number };
  surroundingText: string;
  relatedKeywords: string[];
}

interface QualityCheckMetadata {
  checkId: string;
  timestamp: string;
  processingTimeMs: number;
  rulesApplied: string[];
  statisticsUpdated: boolean;
}

type ErrorCategory = 'VALIDATION' | 'API' | 'BUSINESS' | 'SYSTEM' | 'SECURITY';

// ========================================
// Result型パターンの実装
// ========================================

abstract class Result<T, E = Error> {
  abstract isSuccess(): this is Success<T, E>;
  abstract isFailure(): this is Failure<T, E>;
  
  abstract map<U>(fn: (value: T) => U): Result<U, E>;
  abstract mapError<F>(fn: (error: E) => F): Result<T, F>;
  abstract flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  
  static success<T, E = Error>(value: T): Result<T, E> {
    return new Success(value);
  }
  
  static failure<T, E = Error>(error: E): Result<T, E> {
    return new Failure(error);
  }
}

class Success<T, E = Error> extends Result<T, E> {
  constructor(public readonly value: T) {
    super();
  }
  
  isSuccess(): this is Success<T, E> {
    return true;
  }
  
  isFailure(): this is Failure<T, E> {
    return false;
  }
  
  map<U>(fn: (value: T) => U): Result<U, E> {
    try {
      return Result.success(fn(this.value));
    } catch (error) {
      return Result.failure(error as E);
    }
  }
  
  mapError<F>(_fn: (error: E) => F): Result<T, F> {
    return Result.success(this.value);
  }
  
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    try {
      return fn(this.value);
    } catch (error) {
      return Result.failure(error as E);
    }
  }
}

class Failure<T, E = Error> extends Result<T, E> {
  constructor(public readonly error: E) {
    super();
  }
  
  isSuccess(): this is Success<T, E> {
    return false;
  }
  
  isFailure(): this is Failure<T, E> {
    return true;
  }
  
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return Result.failure(this.error);
  }
  
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return Result.failure(fn(this.error));
  }
  
  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return Result.failure(this.error);
  }
}

// ========================================
// カスタムエラー型
// ========================================

abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;
  
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class QAValidationError extends AppError {
  readonly code = 'QA_VALIDATION_ERROR';
  readonly category = 'VALIDATION' as const;
  
  constructor(
    message: string,
    public readonly qaEntry?: QAKnowledgeEntry,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

class QualityCheckError extends AppError {
  readonly code = 'QUALITY_CHECK_ERROR';
  readonly category = 'BUSINESS' as const;
  
  constructor(
    message: string,
    public readonly checkType?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

class APIError extends AppError {
  readonly code = 'API_ERROR';
  readonly category = 'API' as const;
  
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly apiEndpoint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, context);
  }
}

// ========================================
// ロガーインターフェース
// ========================================

interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error | AppError): void;
}

class ConsoleLogger implements Logger {
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }
  
  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[INFO] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }
  
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context ? JSON.stringify(context, null, 2) : '');
  }
  
  error(message: string, error?: Error | AppError): void {
    console.error(`[ERROR] ${message}`, error);
  }
}

// ========================================
// 強化されたQAナレッジエージェント
// ========================================

class TypeSafeQAKnowledgeAgent {
  private readonly logger: Logger;
  
  constructor(logger: Logger = new ConsoleLogger()) {
    this.logger = logger;
  }

  /**
   * QAナレッジの検証
   */
  validateQAKnowledge(qaKnowledge: unknown[]): Result<QAKnowledgeEntry[], QAValidationError> {
    try {
      const validatedEntries: QAKnowledgeEntry[] = [];
      const errors: string[] = [];

      for (let i = 0; i < qaKnowledge.length; i++) {
        const entry = qaKnowledge[i];
        const validationResult = this.validateSingleQAEntry(entry, i);
        
        if (validationResult.isFailure()) {
          errors.push(validationResult.error.message);
          continue;
        }
        
        if (validationResult.isSuccess()) {
          validatedEntries.push(validationResult.value);
        }
      }

      if (errors.length > 0) {
        return Result.failure(new QAValidationError(
          `QAナレッジ検証エラー: ${errors.join(', ')}`,
          undefined,
          { errorCount: errors.length, totalEntries: qaKnowledge.length }
        ));
      }

      this.logger.info('QAナレッジ検証完了', { 
        validEntries: validatedEntries.length,
        totalEntries: qaKnowledge.length 
      });
      
      return Result.success(validatedEntries);
      
    } catch (error) {
      const appError = new QAValidationError(
        'QAナレッジ検証中に予期しないエラーが発生しました',
        undefined,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
      
      this.logger.error('QAナレッジ検証エラー', appError);
      return Result.failure(appError);
    }
  }

  /**
   * 品質チェックの実行
   */
  async performQualityCheck(
    reviewText: string,
    qaKnowledge: QAKnowledgeEntry[]
  ): Promise<Result<QualityCheckResult, QualityCheckError>> {
    const checkId = this.generateCheckId();
    const startTime = Date.now();
    
    try {
      this.logger.debug('品質チェック開始', { checkId, textLength: reviewText.length });
      
      // 1. 入力検証
      if (!reviewText || reviewText.trim().length === 0) {
        return Result.failure(new QualityCheckError(
          'レビューテキストが空です',
          'input_validation',
          { checkId }
        ));
      }

      // 2. 直接違反チェック
      const directViolationsResult = await this.checkDirectViolations(
        reviewText, 
        qaKnowledge, 
        checkId
      );
      
      if (directViolationsResult.isFailure()) {
        return Result.failure(directViolationsResult.error);
      }

      // 3. パターン違反チェック
      const patternViolationsResult = await this.checkPatternViolations(
        reviewText, 
        qaKnowledge, 
        checkId
      );
      
      if (patternViolationsResult.isFailure()) {
        return Result.failure(patternViolationsResult.error);
      }

      // 4. 結果の統合（型ガード後のvalueアクセス）
      const directViolations = directViolationsResult.isSuccess() ? directViolationsResult.value : [];
      const patternViolations = patternViolationsResult.isSuccess() ? patternViolationsResult.value : [];
      const allViolations = [...directViolations, ...patternViolations];

      const recommendations = this.generateRecommendations(allViolations, qaKnowledge);
      const score = this.calculateQualityScore(allViolations, reviewText);
      
      const result: QualityCheckResult = {
        passed: allViolations.filter(v => v.severity === '致命的' || v.severity === '高').length === 0,
        score,
        violations: allViolations,
        recommendations,
        metadata: {
          checkId,
          timestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          rulesApplied: qaKnowledge.map(qa => qa.question),
          statisticsUpdated: true
        }
      };

      this.logger.info('品質チェック完了', {
        checkId,
        passed: result.passed,
        score: result.score,
        violationCount: allViolations.length,
        processingTimeMs: result.metadata.processingTimeMs
      });

      return Result.success(result);
      
    } catch (error) {
      const appError = new QualityCheckError(
        '品質チェック中にエラーが発生しました',
        'system_error',
        { 
          checkId,
          originalError: error instanceof Error ? error.message : String(error),
          processingTimeMs: Date.now() - startTime
        }
      );
      
      this.logger.error('品質チェックエラー', appError);
      return Result.failure(appError);
    }
  }

  // プライベートメソッド

  private validateSingleQAEntry(entry: unknown, index: number): Result<QAKnowledgeEntry, QAValidationError> {
    if (!entry || typeof entry !== 'object') {
      return Result.failure(new QAValidationError(
        `エントリ${index}: オブジェクトである必要があります`,
        undefined,
        { index, actualType: typeof entry }
      ));
    }

    const obj = entry as Record<string, unknown>;

    // 必須フィールドの検証
    const requiredFields: (keyof QAKnowledgeEntry)[] = ['question', 'answer', 'category', 'priority'];
    for (const field of requiredFields) {
      if (!obj[field] || typeof obj[field] !== 'string') {
        return Result.failure(new QAValidationError(
          `エントリ${index}: 必須フィールド '${field}' がありません`,
          undefined,
          { index, field, actualValue: obj[field] }
        ));
      }
    }

    // カテゴリの検証
    const validCategories: QACategory[] = [
      '表現問題', '内容問題', '構造問題', '規制問題', '業界固有問題', '文脈依存', 'その他'
    ];
    if (!validCategories.includes(obj.category as QACategory)) {
      return Result.failure(new QAValidationError(
        `エントリ${index}: 無効なカテゴリ '${obj.category}'`,
        undefined,
        { index, invalidCategory: obj.category, validCategories }
      ));
    }

    // 優先度の検証
    const validPriorities: QAPriority[] = ['Critical', 'High', 'Medium', 'Low'];
    if (!validPriorities.includes(obj.priority as QAPriority)) {
      return Result.failure(new QAValidationError(
        `エントリ${index}: 無効な優先度 '${obj.priority}'`,
        undefined,
        { index, invalidPriority: obj.priority, validPriorities }
      ));
    }

    return Result.success({
      question: obj.question as string,
      answer: obj.answer as string,
      category: obj.category as QACategory,
      priority: obj.priority as QAPriority,
      example_situation: obj.example_situation as string | undefined,
      example_before: obj.example_before as string | undefined,
      example_after: obj.example_after as string | undefined,
      created_date: obj.created_date as string | undefined,
      effectiveness_score: typeof obj.effectiveness_score === 'number' ? obj.effectiveness_score : undefined
    });
  }

  private async checkDirectViolations(
    reviewText: string,
    qaKnowledge: QAKnowledgeEntry[],
    checkId: string
  ): Promise<Result<QualityViolation[], QualityCheckError>> {
    try {
      const violations: QualityViolation[] = [];
      
      for (const qa of qaKnowledge) {
        if (qa.example_before && reviewText.includes(qa.example_before)) {
          violations.push({
            id: `${checkId}_direct_${violations.length}`,
            type: 'QAナレッジ違反',
            description: `${qa.question}: "${qa.example_before}"を使用`,
            severity: this.mapPriorityToSeverity(qa.priority),
            confidence: 1.0,
            relatedQA: qa.question,
            detectionMethod: 'exact',
            suggestedFix: qa.example_after,
            context: {
              position: this.findTextPosition(reviewText, qa.example_before),
              surroundingText: this.extractSurroundingText(reviewText, qa.example_before),
              relatedKeywords: [qa.example_before]
            }
          });
        }
      }
      
      return Result.success(violations);
      
    } catch (error) {
      return Result.failure(new QualityCheckError(
        '直接違反チェック中にエラーが発生しました',
        'direct_violations',
        { checkId, originalError: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  private async checkPatternViolations(
    reviewText: string,
    qaKnowledge: QAKnowledgeEntry[],
    checkId: string
  ): Promise<Result<QualityViolation[], QualityCheckError>> {
    try {
      const violations: QualityViolation[] = [];
      
      // カテゴリ別パターンチェック
      const categoryPatterns = this.getCategoryPatterns();
      
      for (const qa of qaKnowledge) {
        const patterns = categoryPatterns[qa.category] || [];
        
        for (const pattern of patterns) {
          if (pattern.regex.test(reviewText)) {
            violations.push({
              id: `${checkId}_pattern_${violations.length}`,
              type: `${qa.category}パターン違反`,
              description: `${qa.question}: ${pattern.description}`,
              severity: this.degradeSeverity(this.mapPriorityToSeverity(qa.priority)),
              confidence: 0.8,
              relatedQA: qa.question,
              detectionMethod: 'pattern',
              context: {
                position: { start: 0, end: reviewText.length },
                surroundingText: reviewText.substring(0, 100) + '...',
                relatedKeywords: []
              }
            });
          }
        }
      }
      
      return Result.success(violations);
      
    } catch (error) {
      return Result.failure(new QualityCheckError(
        'パターン違反チェック中にエラーが発生しました',
        'pattern_violations',
        { checkId, originalError: error instanceof Error ? error.message : String(error) }
      ));
    }
  }

  // ユーティリティメソッド
  
  private generateCheckId(): string {
    return `qa_check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private mapPriorityToSeverity(priority: QAPriority): ViolationSeverity {
    const mapping: Record<QAPriority, ViolationSeverity> = {
      'Critical': '致命的',
      'High': '高',
      'Medium': '中',
      'Low': '低'
    };
    return mapping[priority];
  }
  
  private degradeSeverity(severity: ViolationSeverity): ViolationSeverity {
    const degradation: Record<ViolationSeverity, ViolationSeverity> = {
      '致命的': '高',
      '高': '中',
      '中': '低',
      '低': '低'
    };
    return degradation[severity];
  }
  
  private findTextPosition(text: string, searchText: string): { start: number; end: number } {
    const start = text.indexOf(searchText);
    return {
      start: start !== -1 ? start : 0,
      end: start !== -1 ? start + searchText.length : 0
    };
  }
  
  private extractSurroundingText(text: string, searchText: string, padding = 50): string {
    const start = text.indexOf(searchText);
    if (start === -1) return text.substring(0, 100);
    
    const contextStart = Math.max(0, start - padding);
    const contextEnd = Math.min(text.length, start + searchText.length + padding);
    
    return text.substring(contextStart, contextEnd);
  }
  
  private getCategoryPatterns(): Record<QACategory, Array<{ regex: RegExp; description: string }>> {
    return {
      '表現問題': [
        { regex: /(.{1,3})\1{3,}/g, description: '同じ文字の繰り返し' },
        { regex: /[！]{3,}/g, description: '感嘆符の過度な使用' }
      ],
      '内容問題': [
        { regex: /絶対|確実|必ず|100%/g, description: '断定的表現' }
      ],
      '構造問題': [
        { regex: /です。です。/g, description: '同じ語尾の連続' }
      ],
      '規制問題': [],
      '業界固有問題': [],
      '文脈依存': [],
      'その他': []
    };
  }
  
  private generateRecommendations(violations: QualityViolation[], qaKnowledge: QAKnowledgeEntry[]): string[] {
    const recommendations: string[] = [];
    
    for (const violation of violations) {
      if (violation.suggestedFix) {
        recommendations.push(violation.suggestedFix);
      }
      
      const relatedQA = qaKnowledge.find(qa => qa.question === violation.relatedQA);
      if (relatedQA && relatedQA.answer) {
        recommendations.push(relatedQA.answer);
      }
    }
    
    return Array.from(new Set(recommendations));
  }
  
  private calculateQualityScore(violations: QualityViolation[], reviewText: string): number {
    let score = 10.0;
    
    for (const violation of violations) {
      switch (violation.severity) {
        case '致命的':
          score -= 3.0;
          break;
        case '高':
          score -= 2.0;
          break;
        case '中':
          score -= 1.0;
          break;
        case '低':
          score -= 0.5;
          break;
      }
    }
    
    return Math.max(0, Math.min(10, score));
  }
}

// ========================================
// エクスポート
// ========================================

export {
  TypeSafeQAKnowledgeAgent,
  Result,
  Success,
  Failure,
  AppError,
  QAValidationError,
  QualityCheckError,
  APIError,
  ConsoleLogger
};

export type {
  QAKnowledgeEntry,
  QualityCheckResult,
  QualityViolation,
  QACategory,
  QAPriority,
  ViolationSeverity,
  DetectionMethod,
  ViolationContext,
  QualityCheckMetadata,
  ErrorCategory,
  Logger
}; 