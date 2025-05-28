/**
 * @file SimpleReviewGenerator.tsx
 * @description 改良版レビュー生成コンポーネント（型安全性・パフォーマンス・アクセシビリティ改善）
 * React ベストプラクティス準拠、メモ化、エラーバウンダリ対応
 */

import React, { useState, useCallback, useMemo } from 'react';
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { useReviewGenerationErrorHandler } from '../hooks/useErrorHandler';
import { withReviewErrorBoundary } from './withErrorBoundary';

// 型安全なコンポーネントProps
interface SimpleReviewGeneratorProps {
  csvConfig: CSVConfig | null;
  onReviewsGenerated?: (reviews: GeneratedReview[]) => void;
  onError?: (error: string) => void;
  maxReviews?: number;
  className?: string;
}

// 生成モード定義
const GENERATION_MODES = [
  { key: 'minimal' as const, label: 'クイック生成', description: '最大5件、高速', maxReviews: 5 },
  { key: 'single' as const, label: '単体生成', description: '1件、高品質', maxReviews: 1 },
  { key: 'batch' as const, label: 'バッチ生成', description: '最大20件、標準', maxReviews: 20 },
  { key: 'intelligent' as const, label: '知的生成', description: '最大100件、高度', maxReviews: 100 }
] as const;

type GenerationMode = typeof GENERATION_MODES[number]['key'];

// リクエスト・レスポンス型定義
interface GenerateRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  mode: GenerationMode;
  customPrompt?: string;
  saveToDB?: boolean;
}

interface GenerateResponse {
  success: boolean;
  data?: {
    reviews: GeneratedReview[];
    metadata: {
      totalGenerated: number;
      qualityFiltered: number;
      averageScore: number;
      processingTime: number;
    };
  };
  error?: {
    message: string;
    code: string;
  };
}

/**
 * カスタムフック：レビュー生成ロジック（エラーハンドリング強化版）
 */
function useReviewGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const errorHandler = useReviewGenerationErrorHandler();

  const generateReviews = useCallback(async (request: GenerateRequest): Promise<GeneratedReview[]> => {
    setIsGenerating(true);
    setProgress(0);
    errorHandler.clearError();

    try {
      const response = await fetch('/api/reviews/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: GenerateResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Unknown error occurred');
      }

      setProgress(100);
      return result.data.reviews;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      errorHandler.handleError(error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [errorHandler]);

  return { 
    generateReviews, 
    isGenerating, 
    progress, 
    error: errorHandler.error?.message || null,
    retry: errorHandler.retry,
    canRetry: errorHandler.canRetry
  };
}

/**
 * メインコンポーネント
 */
export const SimpleReviewGenerator: React.FC<SimpleReviewGeneratorProps> = React.memo(({
  csvConfig,
  onReviewsGenerated,
  onError,
  maxReviews = 20,
  className = ''
}) => {
  const [selectedMode, setSelectedMode] = useState<GenerationMode>('minimal');
  const [reviewCount, setReviewCount] = useState(5);
  const [customPrompt, setCustomPrompt] = useState('');
  const [saveToDB, setSaveToDB] = useState(false);

  const { generateReviews, isGenerating, progress, error, retry, canRetry } = useReviewGeneration();

  // 選択されたモードの情報を取得
  const currentMode = useMemo(() => 
    GENERATION_MODES.find(mode => mode.key === selectedMode) || GENERATION_MODES[0],
    [selectedMode]
  );

  // レビュー数の制限
  const effectiveMaxReviews = useMemo(() => 
    Math.min(maxReviews, currentMode.maxReviews),
    [maxReviews, currentMode.maxReviews]
  );

  // フォーム送信ハンドラ
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!csvConfig) {
      const errorMsg = 'CSVファイルが読み込まれていません';
      onError?.(errorMsg);
      return;
    }

    try {
      const reviews = await generateReviews({
        csvConfig,
        reviewCount: Math.min(reviewCount, effectiveMaxReviews),
        mode: selectedMode,
        customPrompt: customPrompt.trim() || undefined,
        saveToDB
      });

      onReviewsGenerated?.(reviews);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Generation failed';
      onError?.(errorMessage);
    }
  }, [csvConfig, generateReviews, reviewCount, effectiveMaxReviews, selectedMode, customPrompt, saveToDB, onReviewsGenerated, onError]);

  // モード変更ハンドラ
  const handleModeChange = useCallback((mode: GenerationMode) => {
    setSelectedMode(mode);
    const modeInfo = GENERATION_MODES.find(m => m.key === mode);
    if (modeInfo && reviewCount > modeInfo.maxReviews) {
      setReviewCount(modeInfo.maxReviews);
    }
  }, [reviewCount]);

  // 無効状態の判定
  const isDisabled = !csvConfig || isGenerating;

  return (
    <Card className={`max-w-2xl mx-auto ${className}`}>
      <CardHeader>
        <CardTitle>レビュー生成</CardTitle>
        <CardDescription>
          CSVデータを基にして自然な日本語レビューを生成します
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 生成モード選択 */}
          <div className="space-y-3">
            <label className="text-sm font-medium">生成モード</label>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="生成モード選択">
              {GENERATION_MODES.map((mode) => (
                <div
                  key={mode.key}
                  className={`relative cursor-pointer rounded-lg border p-4 hover:bg-accent ${
                    selectedMode === mode.key ? 'border-primary bg-accent' : 'border-border'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !isDisabled && handleModeChange(mode.key)}
                >
                  <input
                    type="radio"
                    name="generationMode"
                    value={mode.key}
                    checked={selectedMode === mode.key}
                    onChange={() => handleModeChange(mode.key)}
                    disabled={isDisabled}
                    className="sr-only"
                    aria-describedby={`mode-${mode.key}-description`}
                  />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm">{mode.label}</div>
                      <Badge variant="secondary" className="text-xs">
                        最大{mode.maxReviews}件
                      </Badge>
                    </div>
                    <div id={`mode-${mode.key}-description`} className="text-xs text-muted-foreground">
                      {mode.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* レビュー数設定 */}
          <div className="space-y-2">
            <label htmlFor="reviewCount" className="text-sm font-medium">
              生成数 <Badge variant="outline">最大: {effectiveMaxReviews}件</Badge>
            </label>
            <input
              id="reviewCount"
              type="number"
              min="1"
              max={effectiveMaxReviews}
              value={reviewCount}
              onChange={(e) => setReviewCount(Math.min(Number(e.target.value), effectiveMaxReviews))}
              disabled={isDisabled}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-describedby="review-count-help"
            />
            <div id="review-count-help" className="text-xs text-muted-foreground">
              {currentMode.description}を選択中
            </div>
          </div>

          {/* カスタムプロンプト */}
          <div className="space-y-2">
            <label htmlFor="customPrompt" className="text-sm font-medium">
              カスタムプロンプト（オプション）
            </label>
            <textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="追加の指示があれば入力してください..."
              disabled={isDisabled}
              rows={3}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-describedby="custom-prompt-help"
            />
            <div id="custom-prompt-help" className="text-xs text-muted-foreground">
              レビューの内容や特徴について追加の指示を入力できます
            </div>
          </div>

          {/* オプション設定 */}
          <div className="flex items-center space-x-2">
            <input
              id="saveToDB"
              type="checkbox"
              checked={saveToDB}
              onChange={(e) => setSaveToDB(e.target.checked)}
              disabled={isDisabled}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="saveToDB" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              データベースに保存
            </label>
          </div>

          {/* 生成ボタン */}
          <Button
            type="submit"
            disabled={isDisabled}
            className="w-full"
            size="lg"
          >
            {isGenerating ? '生成中...' : `${reviewCount}件のレビューを生成`}
          </Button>

          {/* プログレス表示 */}
          {isGenerating && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="text-center text-sm text-muted-foreground">
                {progress < 100 ? `${progress}% 完了` : '処理完了'}
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>エラーが発生しました</AlertTitle>
              <AlertDescription className="mt-2">
                {error}
                {canRetry && (
                  <div className="mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => retry(() => handleSubmit(new Event('submit') as any))}
                    >
                      再試行
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
});

SimpleReviewGenerator.displayName = 'SimpleReviewGenerator';

// Export component wrapped with error boundary
export default withReviewErrorBoundary(SimpleReviewGenerator);