/**
 * @file BatchManager.tsx
 * @description バッチ管理コンポーネント
 * 
 * 概要:
 * - 複数バッチでの大量レビュー生成機能
 * - バッチ履歴管理・検索機能
 * - CSV一括出力機能
 * - 進捗管理・ステータス表示
 * 
 * 主な機能:
 * - バッチ生成設定（サイズ×回数）
 * - バッチ一覧表示・フィルタリング
 * - レビュー一覧表示・品質管理
 * - CSV一括ダウンロード
 * 
 * 制限事項:
 * - 最大500件まで（バッチサイズ×バッチ数）
 * - データベース接続が必要
 */

import React, { useState, useEffect } from 'react';
import { CSVConfig } from '../types/csv';
import { GeneratedReview, GenerationBatch } from '../types/review';

interface BatchManagerProps {
  csvConfig: CSVConfig | null;
  customPrompt?: string;
}

interface BatchGenerationSettings {
  batchSize: number;
  batchCount: number;
  batchName: string;
}

/**
 * バッチ管理メインコンポーネント
 */
const BatchManager: React.FC<BatchManagerProps> = ({ csvConfig, customPrompt }) => {
  // ステート管理
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'export'>('generate');
  const [batchSettings, setBatchSettings] = useState<BatchGenerationSettings>({
    batchSize: 100,
    batchCount: 5,
    batchName: `Batch_${new Date().toISOString().split('T')[0]}`
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  
  // データ管理
  const [batches, setBatches] = useState<GenerationBatch[]>([]);
  const [reviews, setReviews] = useState<GeneratedReview[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dbStats, setDbStats] = useState<any>(null);
  
  // フィルタリング
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<number>(0);

  /**
   * バッチ一覧を取得
   */
  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/batch-history?action=list-batches');
      if (response.ok) {
        const data = await response.json();
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error('バッチ一覧取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * データベース統計情報を取得
   */
  const fetchDatabaseStats = async () => {
    try {
      const response = await fetch('/api/batch-history?action=get-database-stats');
      if (response.ok) {
        const data = await response.json();
        setDbStats(data.stats);
      }
    } catch (error) {
      console.error('統計情報取得エラー:', error);
    }
  };

  /**
   * レビュー一覧を取得
   */
  const fetchReviews = async (batchId?: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (batchId) params.append('batchId', batchId);
      if (qualityFilter > 0) params.append('minQualityScore', qualityFilter.toString());
      
      const response = await fetch(`/api/batch-history?action=list-reviews&${params}`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('レビュー一覧取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * バッチ生成実行
   */
  const handleBatchGeneration = async () => {
    if (!csvConfig) {
      alert('CSVファイルをアップロードしてください');
      return;
    }

    const totalReviews = batchSettings.batchSize * batchSettings.batchCount;
    if (totalReviews > 500) {
      alert('総レビュー数は500件以下にしてください');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress('バッチ生成を開始しています...');

      const response = await fetch('/api/batch-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvConfig,
          batchSize: batchSettings.batchSize,
          batchCount: batchSettings.batchCount,
          customPrompt,
          batchName: batchSettings.batchName
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGenerationProgress(`✅ ${data.totalBatches}バッチ（総${data.totalReviews}件）の生成を開始しました`);
        
        // バッチ一覧を更新
        await fetchBatches();
        
        // 履歴タブに切り替え
        setTimeout(() => {
          setActiveTab('history');
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'バッチ生成に失敗しました');
      }
    } catch (error) {
      console.error('バッチ生成エラー:', error);
      setGenerationProgress(`❌ エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * 全バッチを削除
   */
  const handleDeleteAllBatches = async () => {
    const confirmMessage = `⚠️ 警告: 全てのバッチとレビューを削除しますか？\n\nこの操作は取り消せません。\n\n現在のデータ:\n- バッチ数: ${dbStats?.batches || '不明'}件\n- レビュー数: ${dbStats?.reviews || '不明'}件\n\n本当に削除しますか？`;
    if (!confirm(confirmMessage)) {
      return;
    }

    const doubleConfirm = confirm('最終確認: 本当に全てのデータを削除しますか？');
    if (!doubleConfirm) {
      return;
    }

    try {
      setIsLoading(true);
      console.log('🗑️ フロントエンド: 全削除開始');
      
      const response = await fetch('/api/batch-history?action=delete-all-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      console.log('📡 全削除API応答:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();
      console.log('📊 全削除結果データ:', data);

      if (response.ok) {
        alert(`${data.result.success}件のバッチを削除しました`);
        
        // 全てをクリア
        setSelectedBatches([]);
        setBatches([]);
        setReviews([]);
        
        // 統計情報を更新
        await fetchDatabaseStats();
        
        console.log('🎉 フロントエンド: 全削除処理完了');
      } else {
        throw new Error(data.error || '全バッチ削除に失敗しました');
      }
    } catch (error) {
      console.error('❌ フロントエンド: 全削除エラー:', error);
      alert(`全削除エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 選択されたバッチを削除
   */
  const handleDeleteSelectedBatches = async () => {
    if (selectedBatches.length === 0) {
      alert('削除するバッチを選択してください');
      return;
    }

    const confirmMessage = `選択された${selectedBatches.length}件のバッチとそれに関連するレビューを削除しますか？\n\nこの操作は取り消せません。`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      console.log('🗑️ フロントエンド: 一括削除開始', selectedBatches);
      
      const response = await fetch('/api/batch-history?action=delete-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchIds: selectedBatches
        }),
      });

      console.log('📡 削除API応答:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();
      console.log('📊 削除結果データ:', data);

      if (response.ok) {
        if (data.partialSuccess) {
          alert(`${data.result.success}件のバッチを削除しました（${data.result.failed}件失敗）\n\n失敗したバッチ:\n${data.result.errors.join('\n')}`);
        } else {
          alert(`${data.result.success}件のバッチを削除しました`);
        }
        
        // 選択をクリア
        setSelectedBatches([]);
        console.log('✅ 選択バッチクリア完了');
        
        // バッチ一覧を強制更新
        console.log('🔄 バッチ一覧更新開始');
        await fetchBatches();
        console.log('✅ バッチ一覧更新完了');
        
        // レビュー一覧もクリア
        setReviews([]);
        console.log('✅ レビュー一覧クリア完了');
        
        console.log('🎉 フロントエンド: 一括削除処理完了');
      } else {
        throw new Error(data.error || 'バッチ削除に失敗しました');
      }
    } catch (error) {
      console.error('❌ フロントエンド: バッチ削除エラー:', error);
      alert(`バッチ削除エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 単一バッチを削除
   */
  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    const confirmMessage = `バッチ「${batchName}」とそれに関連するレビューを削除しますか？\n\nこの操作は取り消せません。`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      console.log('🗑️ フロントエンド: 単一削除開始', { batchId, batchName });
      
      const response = await fetch('/api/batch-history?action=delete-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchId: batchId
        }),
      });

      console.log('📡 削除API応答:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      const data = await response.json();
      console.log('📊 削除結果データ:', data);

      if (response.ok) {
        alert('バッチを削除しました');
        
        // 選択からも削除
        setSelectedBatches(prev => prev.filter(id => id !== batchId));
        console.log('✅ 選択バッチから削除完了');
        
        // バッチ一覧を強制更新
        console.log('🔄 バッチ一覧更新開始');
        await fetchBatches();
        console.log('✅ バッチ一覧更新完了');
        
        // レビュー一覧もクリア
        setReviews([]);
        console.log('✅ レビュー一覧クリア完了');
        
        console.log('🎉 フロントエンド: 単一削除処理完了');
      } else {
        throw new Error(data.error || 'バッチ削除に失敗しました');
      }
    } catch (error) {
      console.error('❌ フロントエンド: バッチ削除エラー:', error);
      alert(`バッチ削除エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * CSV一括出力
   */
  const handleCSVExport = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/batch-history?action=export-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batchIds: selectedBatches.length > 0 ? selectedBatches : undefined,
          minQualityScore: qualityFilter > 0 ? qualityFilter : undefined,
          includeUnapproved: false
        }),
      });

      if (response.ok) {
        // CSVファイルとしてダウンロード
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reviews_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('CSV出力に失敗しました');
      }
    } catch (error) {
      console.error('CSV出力エラー:', error);
      alert(`CSV出力エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 初期化
   */
  useEffect(() => {
    fetchBatches();
    fetchDatabaseStats();
  }, []);

  /**
   * バッチ生成タブ
   */
  const renderGenerateTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">バッチ生成設定</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              バッチサイズ（1バッチあたりの件数）
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={batchSettings.batchSize}
              onChange={(e) => setBatchSettings(prev => ({
                ...prev,
                batchSize: parseInt(e.target.value) || 1
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              バッチ数（実行回数）
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={batchSettings.batchCount}
              onChange={(e) => setBatchSettings(prev => ({
                ...prev,
                batchCount: parseInt(e.target.value) || 1
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              バッチ名
            </label>
            <input
              type="text"
              value={batchSettings.batchName}
              onChange={(e) => setBatchSettings(prev => ({
                ...prev,
                batchName: e.target.value
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-md mb-4">
          <p className="text-sm text-gray-600">
            <strong>総レビュー数:</strong> {batchSettings.batchSize * batchSettings.batchCount}件
          </p>
          <p className="text-sm text-gray-600">
            <strong>予想実行時間:</strong> 約{Math.ceil(batchSettings.batchCount * 2)}分
          </p>
        </div>
        
        <button
          onClick={handleBatchGeneration}
          disabled={isGenerating || !csvConfig}
          className={`w-full py-3 px-4 rounded-md font-medium ${
            isGenerating || !csvConfig
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isGenerating ? '生成中...' : 'バッチ生成開始'}
        </button>
        
        {generationProgress && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">{generationProgress}</p>
          </div>
        )}
      </div>
    </div>
  );

  /**
   * 履歴管理タブ
   */
  const renderHistoryTab = () => (
    <div className="space-y-6">
      {/* 統計情報 */}
      {dbStats && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-800 mb-2">📊 データベース統計</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{dbStats.batches}</div>
              <div className="text-blue-700">バッチ数</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{dbStats.reviews}</div>
              <div className="text-blue-700">レビュー数</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{dbStats.qualityLogs}</div>
              <div className="text-blue-700">品質ログ数</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">バッチ履歴</h3>
          <div className="flex space-x-2">
            <button
              onClick={handleDeleteAllBatches}
              disabled={isLoading || !dbStats || dbStats.batches === 0}
              className={`px-4 py-2 rounded-md font-medium ${
                isLoading || !dbStats || dbStats.batches === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-800 text-white hover:bg-red-900'
              }`}
              title="全てのバッチとレビューを削除"
            >
              🗑️ 全削除
            </button>
            <button
              onClick={handleDeleteSelectedBatches}
              disabled={isLoading || selectedBatches.length === 0}
              className={`px-4 py-2 rounded-md font-medium ${
                isLoading || selectedBatches.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              🗑️ 選択削除 ({selectedBatches.length})
            </button>
            <button
              onClick={() => {
                fetchBatches();
                fetchDatabaseStats();
              }}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              {isLoading ? '更新中...' : '🔄 更新'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  選択
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  バッチ名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  進捗
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  作成日時
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedBatches.includes(batch.id || '')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBatches(prev => [...prev, batch.id || '']);
                        } else {
                          setSelectedBatches(prev => prev.filter(id => id !== batch.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {batch.batchName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                      batch.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      batch.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {batch.completedCount}/{batch.totalCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {batch.createdAt ? new Date(batch.createdAt).toLocaleString('ja-JP') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => fetchReviews(batch.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        📋 詳細
                      </button>
                      <button
                        onClick={() => handleDeleteBatch(batch.id || '', batch.batchName || '')}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="このバッチを削除"
                      >
                        🗑️ 削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  /**
   * CSV出力タブ
   */
  const renderExportTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">CSV一括出力</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              品質スコア最小値
            </label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={qualityFilter}
              onChange={(e) => setQualityFilter(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              選択されたバッチ
            </label>
            <p className="text-sm text-gray-600 py-2">
              {selectedBatches.length > 0 ? `${selectedBatches.length}バッチ選択中` : '全バッチ'}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleCSVExport}
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-md font-medium ${
            isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isLoading ? 'エクスポート中...' : 'CSV一括ダウンロード'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">バッチ管理システム</h2>
        <p className="text-gray-600">大量レビュー生成・履歴管理・一括出力機能</p>
      </div>

      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'generate', label: 'バッチ生成', icon: '🚀' },
            { id: 'history', label: '履歴管理', icon: '📋' },
            { id: 'export', label: 'CSV出力', icon: '📤' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'generate' && renderGenerateTab()}
      {activeTab === 'history' && renderHistoryTab()}
      {activeTab === 'export' && renderExportTab()}
    </div>
  );
};

export default BatchManager; 