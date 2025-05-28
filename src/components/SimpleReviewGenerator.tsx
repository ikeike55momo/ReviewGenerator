/**
 * @file SimpleReviewGenerator.tsx
 * @description 改良版レビュー生成コンポーネント（型安全性・パフォーマンス・アクセシビリティ改善）
 * React ベストプラクティス準拠、メモ化、エラーバウンダリ対応
 */

import React, { useState, useCallback, useMemo } from 'react';
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';

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
 * カスタムフック：レビュー生成ロジック
 */
function useReviewGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const generateReviews = useCallback(async (request: GenerateRequest): Promise<GeneratedReview[]> => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

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
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generateReviews, isGenerating, progress, error };
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

  const { generateReviews, isGenerating, progress, error } = useReviewGeneration();

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
    <div className={`review-generator ${className}`}>
      <form onSubmit={handleSubmit} aria-label="レビュー生成フォーム">
        {/* 生成モード選択 */}
        <fieldset className="mode-selection" disabled={isDisabled}>
          <legend>生成モード</legend>
          <div className="mode-grid" role="radiogroup" aria-label="生成モード選択">
            {GENERATION_MODES.map((mode) => (
              <label key={mode.key} className={`mode-option ${selectedMode === mode.key ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="generationMode"
                  value={mode.key}
                  checked={selectedMode === mode.key}
                  onChange={() => handleModeChange(mode.key)}
                  aria-describedby={`mode-${mode.key}-description`}
                />
                <div className="mode-content">
                  <span className="mode-label">{mode.label}</span>
                  <span id={`mode-${mode.key}-description`} className="mode-description">
                    {mode.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* レビュー数設定 */}
        <div className="review-count-section">
          <label htmlFor="reviewCount">
            生成数
            <span aria-label={`最大${effectiveMaxReviews}件`}>
              (最大: {effectiveMaxReviews})
            </span>
          </label>
          <input
            id="reviewCount"
            type="number"
            min="1"
            max={effectiveMaxReviews}
            value={reviewCount}
            onChange={(e) => setReviewCount(Math.min(Number(e.target.value), effectiveMaxReviews))}
            disabled={isDisabled}
            aria-describedby="review-count-help"
          />
          <div id="review-count-help" className="help-text">
            {currentMode.description}を選択中
          </div>
        </div>

        {/* カスタムプロンプト */}
        <div className="custom-prompt-section">
          <label htmlFor="customPrompt">
            カスタムプロンプト（オプション）
          </label>
          <textarea
            id="customPrompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="追加の指示があれば入力してください..."
            disabled={isDisabled}
            rows={3}
            aria-describedby="custom-prompt-help"
          />
          <div id="custom-prompt-help" className="help-text">
            レビューの内容や特徴について追加の指示を入力できます
          </div>
        </div>

        {/* オプション設定 */}
        <div className="options-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={saveToDB}
              onChange={(e) => setSaveToDB(e.target.checked)}
              disabled={isDisabled}
            />
            データベースに保存
          </label>
        </div>

        {/* 生成ボタン */}
        <button
          type="submit"
          disabled={isDisabled}
          className={`generate-button ${isGenerating ? 'generating' : ''}`}
          aria-describedby={isGenerating ? 'generation-progress' : undefined}
        >
          {isGenerating ? '生成中...' : `${reviewCount}件のレビューを生成`}
        </button>

        {/* プログレス表示 */}
        {isGenerating && (
          <div id="generation-progress" className="progress-section" role="status" aria-live="polite">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
                aria-label={`生成進行状況: ${progress}%`}
              />
            </div>
            <span className="progress-text">
              {progress < 100 ? `${progress}% 完了` : '処理完了'}
            </span>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="error-message" role="alert" aria-live="assertive">
            <strong>エラー:</strong> {error}
          </div>
        )}
      </form>

      <style jsx>{`
        .review-generator {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background: #ffffff;
        }

        .mode-selection {
          margin-bottom: 24px;
          border: none;
          padding: 0;
        }

        .mode-selection legend {
          font-weight: 600;
          margin-bottom: 12px;
          padding: 0;
        }

        .mode-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }

        .mode-option {
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mode-option:hover {
          border-color: #007bff;
        }

        .mode-option.selected {
          border-color: #007bff;
          background-color: #f8f9ff;
        }

        .mode-option input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .mode-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mode-label {
          font-weight: 600;
          font-size: 14px;
        }

        .mode-description {
          font-size: 12px;
          color: #666;
        }

        .review-count-section,
        .custom-prompt-section,
        .options-section {
          margin-bottom: 20px;
        }

        .review-count-section label,
        .custom-prompt-section label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .review-count-section input,
        .custom-prompt-section textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .help-text {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .generate-button {
          width: 100%;
          padding: 12px 24px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .generate-button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .generate-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .generate-button.generating {
          background-color: #28a745;
        }

        .progress-section {
          margin-top: 16px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background-color: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background-color: #007bff;
          transition: width 0.3s ease;
        }

        .progress-text {
          display: block;
          text-align: center;
          margin-top: 8px;
          font-size: 14px;
          color: #666;
        }

        .error-message {
          margin-top: 16px;
          padding: 12px;
          background-color: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
});

SimpleReviewGenerator.displayName = 'SimpleReviewGenerator';

export default SimpleReviewGenerator;