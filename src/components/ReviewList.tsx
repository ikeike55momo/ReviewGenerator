/**
 * @file ReviewList.tsx
 * @description 生成レビュー結果表示・管理コンポーネント
 * 主な機能：レビュー一覧表示、品質スコア表示、個別再生成、CSVダウンロード
 * 制限事項：品質フィルタリング、日本語表示、型安全
 */
import React, { useState } from 'react';
import { GeneratedReview } from '../types/review';

interface ReviewListProps {
  reviews: GeneratedReview[];
}

export const ReviewList: React.FC<ReviewListProps> = ({ reviews }) => {
  const [filteredReviews, setFilteredReviews] = useState<GeneratedReview[]>(reviews);
  const [minScore, setMinScore] = useState<number>(0);

  /**
   * 品質スコアによるフィルタリング
   * @param score 最小スコア
   */
  const handleScoreFilter = (score: number) => {
    setMinScore(score);
    setFilteredReviews(reviews.filter(review => (review.qualityScore * 10) >= score));
  };

  /**
   * CSVダウンロード処理（success_examples.csv形式）
   */
  const handleDownloadCSV = () => {
    if (filteredReviews.length === 0) {
      alert('ダウンロードするレビューがありません');
      return;
    }

    // success_examples.csvの形式に合わせる
    const csvHeaders = ['review', 'age', 'gender', 'companion', 'word', 'recommend'];
    const csvRows = filteredReviews.map(review => {
      // 年齢を文字列形式に変換
      const ageString = `${review.reviewerAge}代`;
      
      // 性別を日本語に変換
      const genderString = review.reviewerGender === 'male' ? '男性' : 
                          review.reviewerGender === 'female' ? '女性' : 'その他';
      
      // generationParametersから使用されたキーワードと推奨フレーズを取得
      const usedWords = review.generationParameters?.usedWords || '';
      const selectedRecommendation = review.generationParameters?.selectedRecommendation || '日本酒好きに';
      
      return [
        `"${review.reviewText.replace(/"/g, '""')}"`, // CSVエスケープ
        ageString,
        genderString,
        '一人', // companionは常に一人（個人体験のみ）
        usedWords, // バーティカルライン区切りのキーワード
        selectedRecommendation // 使用された推奨フレーズ
      ];
    });

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `generated_reviews_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * 個別レビュー再生成
   * @param index レビューのインデックス
   */
  const handleRegenerateReview = async (index: number) => {
    // TODO: 個別再生成API呼び出し
    console.log(`レビュー ${index} の再生成を実行`);
    alert('個別再生成機能は今後実装予定です');
  };

  /**
   * 品質スコアの色分け
   * @param score 品質スコア
   * @returns CSSクラス名
   */
  const getScoreColorClass = (score: number): string => {
    if (score >= 8) return 'text-green-600 bg-green-100';
    if (score >= 6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const averageScore = filteredReviews.length > 0 
    ? filteredReviews.reduce((sum, review) => sum + (review.qualityScore * 10), 0) / filteredReviews.length 
    : 0;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6">
      {/* 統計情報 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">{reviews.length}</p>
            <p className="text-sm text-gray-600">総生成数</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{filteredReviews.length}</p>
            <p className="text-sm text-gray-600">フィルタ後</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-600">{averageScore.toFixed(1)}</p>
            <p className="text-sm text-gray-600">平均スコア</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600">
              {filteredReviews.filter(r => (r.qualityScore * 10) >= 8).length}
            </p>
            <p className="text-sm text-gray-600">高品質(8+)</p>
          </div>
        </div>
      </div>

      {/* フィルタリング・ダウンロードコントロール */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            最小品質スコア:
          </label>
          <select
            value={minScore}
            onChange={(e) => handleScoreFilter(parseFloat(e.target.value))}
            className="px-3 py-1 border border-gray-300 rounded text-sm"
          >
            <option value={0}>全て表示</option>
            <option value={6}>6.0以上</option>
            <option value={7}>7.0以上</option>
            <option value={8}>8.0以上（高品質）</option>
            <option value={9}>9.0以上（最高品質）</option>
          </select>
        </div>

        <button
          onClick={handleDownloadCSV}
          disabled={filteredReviews.length === 0}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            filteredReviews.length === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          CSVダウンロード ({filteredReviews.length}件)
        </button>
      </div>

      {/* レビュー一覧 */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>表示するレビューがありません</p>
            {minScore > 0 && (
              <p className="text-sm mt-2">フィルタ条件を緩和してみてください</p>
            )}
          </div>
        ) : (
          filteredReviews.map((review, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getScoreColorClass(review.qualityScore * 10)}`}>
                    スコア: {(review.qualityScore * 10).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {review.reviewerAge}歳 / {review.reviewerGender === 'male' ? '男性' : review.reviewerGender === 'female' ? '女性' : 'その他'} / {review.generationParameters?.selectedPattern?.personality_type || 'Medium型'}
                  </span>
                </div>
                <button
                  onClick={() => handleRegenerateReview(index)}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  再生成
                </button>
              </div>

              <div className="text-gray-800 leading-relaxed">
                {review.reviewText}
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>同伴者: 一人</span>
                  <span>•</span>
                  <span>推奨: {review.generationParameters?.selectedRecommendation || '日本酒好きに'}</span>
                  <span>•</span>
                  <span>業種: {review.generationParameters?.selectedElements?.businessType || 'SHOGUN BAR'}</span>
                  <span>•</span>
                  <span>文字数: {review.reviewText.length}文字</span>
                  {review.generationParameters?.targetLength && (
                    <>
                      <span>•</span>
                      <span>目標: {review.generationParameters.targetLength}文字</span>
                    </>
                  )}
                  <span>•</span>
                  <span>生成時刻: {review.createdAt ? new Date(review.createdAt).toLocaleTimeString('ja-JP') : new Date().toLocaleTimeString('ja-JP')}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ページネーション（将来の拡張用） */}
      {filteredReviews.length > 10 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            {filteredReviews.length}件のレビューを表示中
          </p>
        </div>
      )}
    </div>
  );
}; 