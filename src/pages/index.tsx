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
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isTestingSystem, setIsTestingSystem] = useState(false);

  /**
   * CSVアップロード完了時のハンドラー
   * @param config パース済みCSV設定
   */
  const handleCsvUploadComplete = (config: CSVConfig) => {
    setCsvConfig(config);
    console.log('CSVアップロード完了:', config);
  };

  /**
   * システム接続テストのハンドラー
   */
  const handleSystemTest = async () => {
    setIsTestingSystem(true);
    setSystemStatus(null);

    try {
      const response = await fetch('/api/test-connection');
      
      if (!response.ok) {
        throw new Error(`テストAPIエラー: ${response.status} ${response.statusText}`);
      }

      const testResult = await response.json();
      setSystemStatus(testResult);
    } catch (error) {
      console.error('システムテストエラー:', error);
      setSystemStatus({
        overall: 'error',
        timestamp: new Date().toISOString(),
        results: [{
          component: 'System Test',
          status: 'error',
          message: error instanceof Error ? error.message : '不明なエラー',
        }],
      });
    } finally {
      setIsTestingSystem(false);
    }
  };

  /**
   * レビュー生成開始時のハンドラー
   * @param reviewCount 生成件数
   * @param customPrompt カスタムプロンプト（オプション）
   */
  const handleGenerateReviews = async (reviewCount: number, customPrompt?: string) => {
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
          customPrompt,
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
            
            {/* システムテストボタン */}
            <div className="mt-4">
              <button
                onClick={handleSystemTest}
                disabled={isTestingSystem}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isTestingSystem
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isTestingSystem ? 'システムテスト中...' : 'システム接続テスト'}
              </button>
            </div>
          </header>

          {/* システムテスト結果 */}
          {systemStatus && (
            <section className="mb-8">
              <div className={`border rounded-lg p-4 ${
                systemStatus.overall === 'success' ? 'border-green-300 bg-green-50' :
                systemStatus.overall === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                'border-red-300 bg-red-50'
              }`}>
                <div className="flex items-center mb-3">
                  <div className={`w-3 h-3 rounded-full mr-2 ${
                    systemStatus.overall === 'success' ? 'bg-green-500' :
                    systemStatus.overall === 'warning' ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}></div>
                  <h3 className="text-lg font-medium">
                    システムステータス: {
                      systemStatus.overall === 'success' ? '正常' :
                      systemStatus.overall === 'warning' ? '警告あり' :
                      'エラー'
                    }
                  </h3>
                </div>
                
                <div className="space-y-2">
                  {systemStatus.results.map((result: any, index: number) => (
                    <div key={index} className="flex items-start">
                      <div className={`w-2 h-2 rounded-full mt-2 mr-3 flex-shrink-0 ${
                        result.status === 'success' ? 'bg-green-500' :
                        result.status === 'warning' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}></div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{result.component}</div>
                        <div className="text-sm text-gray-600">{result.message}</div>
                        {result.details && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-500 cursor-pointer">詳細を表示</summary>
                            <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 text-xs text-gray-500">
                  テスト実行時刻: {new Date(systemStatus.timestamp).toLocaleString('ja-JP')}
                </div>
              </div>
            </section>
          )}

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