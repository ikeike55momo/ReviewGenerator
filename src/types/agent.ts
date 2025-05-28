/**
 * エージェント関連の型定義
 * 
 * 概要:
 * - AI エージェントのインターフェース定義
 * - 設定管理とプロンプト生成の型定義
 * - QA システムと禁止事項コントロールの型定義
 * 
 * 主な型:
 * - Agent: 基本エージェントインターフェース
 * - AgentConfig: エージェント設定
 * - ProcessingContext: 処理コンテキスト
 */

/**
 * 基本エージェントインターフェース
 */
export interface Agent<TInput = any, TOutput = any> {
    name: string;
    version: string;
    process(input: TInput, context?: ProcessingContext): Promise<TOutput>;
}

/**
 * エージェント設定
 */
export interface AgentConfig {
    apiKey?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    retryAttempts?: number;
    enableCaching?: boolean;
}

/**
 * 処理コンテキスト
 */
export interface ProcessingContext {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    startTime?: Date;
}

/**
 * CSV パーサーエージェント固有の型
 */
export interface CSVParserInput {
    csvContent: string;
    delimiter?: string;
    headers?: string[];
    skipEmptyLines?: boolean;
}

export interface CSVParserOutput {
    data: Record<string, any>[];
    headers: string[];
    rowCount: number;
    isValid: boolean;
    errors?: string[];
}

/**
 * プロンプトビルダーエージェント固有の型
 */
export interface PromptBuilderInput {
    template: string;
    variables: Record<string, any>;
    rules?: string[];
    examples?: string[];
}

export interface PromptBuilderOutput {
    prompt: string;
    tokenCount?: number;
    variables: Record<string, any>;
}

/**
 * レビュー生成エージェント固有の型
 */
export interface ReviewGeneratorInput {
    prompt: string;
    parameters: GenerationParameters;
    context?: ReviewContext;
}

export interface ReviewGeneratorOutput {
    reviewText: string;
    rating: number;
    qualityScore: number;
    metadata: GenerationMetadata;
}

export interface GenerationParameters {
    temperature: number;
    maxTokens: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
}

export interface ReviewContext {
    businessType?: string;
    targetAudience?: string;
    reviewStyle?: string;
    constraints?: string[];
}

export interface GenerationMetadata {
    generatedAt: Date;
    processingTime: number;
    modelUsed: string;
    tokenUsage: {
        input: number;
        output: number;
        total: number;
    };
}

/**
 * QA 知識エージェント固有の型
 */
export interface QAKnowledgeInput {
    content: string;
    knowledgeBase: KnowledgeEntry[];
    checkType: 'prohibition' | 'quality' | 'both';
}

export interface QAKnowledgeOutput {
    isValid: boolean;
    score: number;
    violations: Violation[];
    suggestions: string[];
}

export interface KnowledgeEntry {
    id: string;
    type: 'prohibition' | 'pattern' | 'rule';
    content: string;
    severity: 'low' | 'medium' | 'high';
    category?: string;
}

export interface Violation {
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    position?: {
        start: number;
        end: number;
    };
}

/**
 * 品質管理エージェント固有の型
 */
export interface QualityControlInput {
    content: string;
    criteria: QualityCriteria;
    thresholds: QualityThresholds;
}

export interface QualityControlOutput {
    overallScore: number;
    criteriaScores: Record<string, number>;
    passed: boolean;
    recommendations: string[];
}

export interface QualityCriteria {
    readability: boolean;
    authenticity: boolean;
    relevance: boolean;
    sentiment: boolean;
    length: boolean;
}

export interface QualityThresholds {
    minimumScore: number;
    readabilityThreshold: number;
    authenticityThreshold: number;
    relevanceThreshold: number;
    sentimentRange: {
        min: number;
        max: number;
    };
    lengthRange: {
        min: number;
        max: number;
    };
}