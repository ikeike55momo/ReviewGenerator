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
import BatchManager from '../components/BatchManager';
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';

export default function HomePage() {
  const [csvConfig, setCsvConfig] = useState<CSVConfig | null>(null);
  const [generatedReviews, setGeneratedReviews] = useState<GeneratedReview[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [isTestingSystem, setIsTestingSystem] = useState(false);
  const [activeMode, setActiveMode] = useState<'single' | 'batch'>('single');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  /**
   * CSVアップロード完了時のハンドラー
   * @param config パース済みCSV設定
   */
  const handleCSVUpload = (config: CSVConfig) => {
    console.log('📁 CSV設定受信:', {
      basicRulesCount: config.basicRules?.length || 0,
      humanPatternsCount: config.humanPatterns?.length || 0,
      qaKnowledgeCount: config.qaKnowledge?.length || 0,
      successExamplesCount: config.successExamples?.length || 0,
      configKeys: Object.keys(config)
    });
    
    setCsvConfig(config);
    console.log('✅ CSVConfig状態更新完了');
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
    console.log('🚀 handleGenerateReviews 開始:', { reviewCount, customPrompt: !!customPrompt, csvConfig: !!csvConfig });
    
    // 詳細デバッグ情報を追加
    console.log('🔍 詳細デバッグ情報:', {
      csvConfigExists: !!csvConfig,
      csvConfigKeys: csvConfig ? Object.keys(csvConfig) : [],
      basicRulesCount: csvConfig?.basicRules?.length || 0,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      qaKnowledgeCount: csvConfig?.qaKnowledge?.length || 0,
      successExamplesCount: csvConfig?.successExamples?.length || 0,
      reviewCount,
      customPromptLength: customPrompt?.length || 0,
      isGenerating
    });
    
    if (!csvConfig) {
      console.error('❌ CSVConfigが未設定');
      alert('CSVファイルをアップロードしてください。\n\n手順:\n1. ページ上部のCSVアップロード領域を確認\n2. 必要なCSVファイルをアップロード\n3. 「読み込み完了」メッセージを確認\n4. 再度生成ボタンを押してください');
      return;
    }

    console.log('✅ CSVConfig確認完了:', {
      basicRules: csvConfig.basicRules?.length || 0,
      humanPatterns: csvConfig.humanPatterns?.length || 0,
      qaKnowledge: csvConfig.qaKnowledge?.length || 0,
      successExamples: csvConfig.successExamples?.length || 0
    });

    setIsGenerating(true);
    setGeneratedReviews([]);

    try {
      console.log('📡 API呼び出し開始...');
      
      const requestBody = {
        csvConfig,
        reviewCount,
        customPrompt,
      };
      
      console.log('📤 リクエストボディ:', {
        csvConfigKeys: Object.keys(csvConfig),
        reviewCount,
        hasCustomPrompt: !!customPrompt
      });

      const response = await fetch('/api/generate-reviews-optimized', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 レスポンス受信:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ APIエラーレスポンス:', errorText);
        throw new Error(`APIエラー: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const reviews: GeneratedReview[] = await response.json();
      console.log('✅ レビュー生成完了:', { count: reviews.length, reviews: reviews.slice(0, 2) });
      setGeneratedReviews(reviews);
    } catch (error) {
      console.error('❌ レビュー生成エラー:', error);
      console.error('エラースタック:', error instanceof Error ? error.stack : 'スタック情報なし');
      alert(`レビュー生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}\n\n詳細はブラウザのコンソール（F12）を確認してください。`);
    } finally {
      console.log('🏁 handleGenerateReviews 終了');
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
            <div className="mt-4 space-x-2">
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
              
              <button
                onClick={async () => {
                  console.log('🧪 デバッグテスト開始');
                  try {
                    const response = await fetch('/api/debug-test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ test: 'debug data' })
                    });
                    const result = await response.json();
                    console.log('✅ デバッグテスト結果:', result);
                    alert(`デバッグテスト成功: ${result.message}`);
                  } catch (error) {
                    console.error('❌ デバッグテストエラー:', error);
                    alert(`デバッグテストエラー: ${error}`);
                  }
                }}
                className="px-4 py-2 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-700"
              >
                デバッグテスト
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

          {/* モード切り替えセクション */}
          <section className="mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                動作モード選択
              </h2>
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveMode('single')}
                  className={`px-6 py-3 rounded-md font-medium ${
                    activeMode === 'single'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  🎯 単発生成モード
                </button>
                <button
                  onClick={() => setActiveMode('batch')}
                  className={`px-6 py-3 rounded-md font-medium ${
                    activeMode === 'batch'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  🚀 バッチ生成モード
                </button>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                {activeMode === 'single' 
                  ? '1-100件の単発レビュー生成（メモリ上のみ）'
                  : '大量バッチ生成・履歴管理・CSV一括出力（データベース連携）'
                }
              </div>
            </div>
          </section>

          {activeMode === 'single' ? (
            <>
              {/* CSVアップロードセクション */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  1. CSVファイルアップロード
                </h2>
                <CSVUploader onUploadComplete={handleCSVUpload} />
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
            </>
          ) : (
            <>
              {/* CSVアップロードセクション（バッチモード用） */}
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  1. CSVファイルアップロード
                </h2>
                <CSVUploader onUploadComplete={handleCSVUpload} />
              </section>

              {/* バッチ管理セクション */}
              {csvConfig && (
                <section className="mb-8">
                  <BatchManager 
                    csvConfig={csvConfig} 
                    customPrompt={customPrompt}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
} 