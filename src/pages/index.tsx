/**
 * @file index.tsx
 * @description CSV駆動型レビュー生成エージェントのメインページ
 * 主な機能：4つのCSVアップロード、プレビュー、バリデーション、レビュー生成リクエスト
 * 制限事項：Netlify/Next.js構成、TypeScript型安全、日本語対応
 */
import React, { useState } from 'react';
import Head from 'next/head';
import { CSVUploader } from '../components/CSVUploader';
import { ReviewGenerator } from '../components/ReviewGenerator';
import { ReviewList } from '../components/ReviewList';
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';

export default function HomePage() {
  const [csvConfig, setCsvConfig] = useState<CSVConfig | null>(null);
  const [generatedReviews, setGeneratedReviews] = useState<GeneratedReview[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * CSVアップロード完了時のハンドラー
   * @param config パース済みCSV設定
   */
  const handleCsvUploadComplete = (config: CSVConfig) => {
    setCsvConfig(config);
    console.log('CSVアップロード完了:', config);
  };

  /**
   * レビュー生成開始時のハンドラー
   * @param reviewCount 生成件数
   */
  const handleGenerateReviews = async (reviewCount: number) => {
    if (!csvConfig) {
      alert('CSVファイルをアップロードしてください');
      return;
    }

    setIsGenerating(true);
    setGeneratedReviews([]);

    try {
      const response = await fetch('/api/generate-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvConfig,
          reviewCount,
        }),
      });

      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
      }

      const reviews: GeneratedReview[] = await response.json();
      setGeneratedReviews(reviews);
    } catch (error) {
      console.error('レビュー生成エラー:', error);
      alert(`レビュー生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Head>
        <title>CSV駆動型レビュー生成エージェント</title>
        <meta name="description" content="4つのCSVファイルから高品質な日本語レビューを自動生成" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              CSV駆動型レビュー生成エージェント
            </h1>
            <p className="text-gray-600">
              4つのCSVファイルをアップロードして、高品質な日本語レビューを自動生成
            </p>
          </header>

          {/* CSVアップロードセクション */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              1. CSVファイルアップロード
            </h2>
            <CSVUploader onUploadComplete={handleCsvUploadComplete} />
          </section>

          {/* レビュー生成セクション */}
          {csvConfig && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                2. レビュー生成設定
              </h2>
              <ReviewGenerator
                onGenerate={handleGenerateReviews}
                isGenerating={isGenerating}
              />
            </section>
          )}

          {/* レビュー結果セクション */}
          {generatedReviews.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                3. 生成結果
              </h2>
              <ReviewList reviews={generatedReviews} />
            </section>
          )}
        </div>
      </main>
    </>
  );
} 