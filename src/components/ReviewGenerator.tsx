/**
 * @file ReviewGenerator.tsx
 * @description レビュー生成設定・実行コンポーネント
 * 主な機能：生成件数スライダー、プロンプト表示・編集、生成ボタン
 * 制限事項：1～100件の範囲、プロンプト編集可能、生成中の状態管理
 */
import React, { useState } from 'react';

interface ReviewGeneratorProps {
  onGenerate: (reviewCount: number) => void;
  isGenerating: boolean;
}

export const ReviewGenerator: React.FC<ReviewGeneratorProps> = ({ onGenerate, isGenerating }) => {
  const [reviewCount, setReviewCount] = useState<number>(10);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  /**
   * 生成件数変更ハンドラー
   * @param value 新しい生成件数
   */
  const handleReviewCountChange = (value: number) => {
    setReviewCount(Math.max(1, Math.min(100, value)));
  };

  /**
   * 生成開始ハンドラー
   */
  const handleGenerate = () => {
    if (isGenerating) return;
    onGenerate(reviewCount);
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6">
      <div className="space-y-6">
        {/* 生成件数設定 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            生成件数: {reviewCount}件
          </label>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">1</span>
            <input
              type="range"
              min="1"
              max="100"
              value={reviewCount}
              onChange={(e) => handleReviewCountChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isGenerating}
            />
            <span className="text-sm text-gray-500">100</span>
          </div>
          <div className="mt-2">
            <input
              type="number"
              min="1"
              max="100"
              value={reviewCount}
              onChange={(e) => handleReviewCountChange(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-1 border border-gray-300 rounded text-sm"
              disabled={isGenerating}
            />
            <span className="ml-2 text-sm text-gray-600">件</span>
          </div>
        </div>

        {/* プロンプト編集エリア */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            AIプロンプト（編集可能）
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="CSVアップロード後、自動生成されたプロンプトがここに表示されます。必要に応じて編集してください。"
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical"
            disabled={isGenerating}
          />
          <p className="mt-1 text-xs text-gray-500">
            ※ CSVの内容に基づいて自動生成されたプロンプトを微調整できます
          </p>
        </div>

        {/* 生成設定オプション */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              年齢層分布
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              disabled={isGenerating}
            >
              <option value="auto">自動（CSVパターンに基づく）</option>
              <option value="20s">20代中心</option>
              <option value="30s">30代中心</option>
              <option value="40s">40代中心</option>
              <option value="mixed">バランス型</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              性別分布
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              disabled={isGenerating}
            >
              <option value="auto">自動（CSVパターンに基づく）</option>
              <option value="male">男性中心</option>
              <option value="female">女性中心</option>
              <option value="balanced">バランス型</option>
            </select>
          </div>
        </div>

        {/* 生成ボタン */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${
              isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>生成中...</span>
              </div>
            ) : (
              `${reviewCount}件のレビューを生成`
            )}
          </button>
        </div>

        {/* 生成時間の目安 */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            予想生成時間: 約{Math.ceil(reviewCount / 10)}分
            {reviewCount <= 20 && ' (パフォーマンス要件: 2分以内)'}
          </p>
        </div>
      </div>
    </div>
  );
}; 