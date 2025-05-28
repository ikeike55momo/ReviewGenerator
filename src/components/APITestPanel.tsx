/**
 * @file APITestPanel.tsx
 * @description API動作確認パネルコンポーネント
 * 主な機能：各APIエンドポイントの動作確認、テスト結果表示
 * 制限事項：開発環境でのみ使用、shadcn/ui使用
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import { runAPITests, APITestSuite } from '../utils/api-test-suite';
import ErrorBoundary from './ErrorBoundary';

interface APITestResult {
  endpoint: string;
  method: string;
  status: 'success' | 'error' | 'warning';
  responseTime: number;
  statusCode?: number;
  error?: string;
  data?: any;
}

interface TestSuiteResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: APITestResult[];
  timestamp: string;
}

export const APITestPanel: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestSuiteResult | null>(null);
  const [progress, setProgress] = useState(0);

  const handleRunTests = async () => {
    setIsRunning(true);
    setProgress(0);
    setTestResults(null);

    try {
      // 進捗更新のシミュレーション
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const results = await runAPITests();
      
      clearInterval(progressInterval);
      setProgress(100);
      setTestResults(results);
      
    } catch (error) {
      console.error('APIテスト実行エラー:', error);
      setTestResults({
        summary: { total: 0, passed: 0, failed: 1, warnings: 0 },
        results: [{
          endpoint: 'test-execution',
          method: 'GET',
          status: 'error',
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return '🔍';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'success': return 'success' as const;
      case 'warning': return 'warning' as const;
      case 'error': return 'destructive' as const;
      default: return 'default' as const;
    }
  };

  return (
    <ErrorBoundary>
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>API動作確認テスト</CardTitle>
          <CardDescription>
            新統合APIエンドポイントの動作状況を確認します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* テスト実行ボタン */}
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleRunTests} 
              disabled={isRunning}
              className="min-w-32"
            >
              {isRunning ? 'テスト実行中...' : 'APIテスト実行'}
            </Button>
            
            {isRunning && (
              <div className="flex-1">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground mt-1">
                  進捗: {progress}%
                </p>
              </div>
            )}
          </div>

          {/* テスト結果概要 */}
          {testResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{testResults.summary.total}</div>
                    <div className="text-sm text-muted-foreground">総テスト数</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.summary.passed}
                    </div>
                    <div className="text-sm text-muted-foreground">成功</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {testResults.summary.warnings}
                    </div>
                    <div className="text-sm text-muted-foreground">警告</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {testResults.summary.failed}
                    </div>
                    <div className="text-sm text-muted-foreground">失敗</div>
                  </CardContent>
                </Card>
              </div>

              {/* 個別テスト結果 */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">個別テスト結果</h3>
                
                {testResults.results.map((result, index) => (
                  <Alert key={index} variant={getStatusVariant(result.status)}>
                    <AlertTitle className="flex items-center gap-2">
                      <span>{getStatusIcon(result.status)}</span>
                      <span>{result.method} /api/{result.endpoint}</span>
                      <span className="text-sm font-normal">
                        ({result.responseTime}ms)
                      </span>
                      {result.statusCode && (
                        <span className="text-sm font-normal">
                          HTTP {result.statusCode}
                        </span>
                      )}
                    </AlertTitle>
                    
                    {result.error && (
                      <AlertDescription className="mt-2">
                        エラー: {result.error}
                      </AlertDescription>
                    )}
                    
                    {result.status === 'success' && result.data && (
                      <AlertDescription className="mt-2">
                        レスポンス確認: OK
                        {result.data.message && (
                          <div className="text-xs mt-1 opacity-75">
                            {result.data.message}
                          </div>
                        )}
                      </AlertDescription>
                    )}
                  </Alert>
                ))}
              </div>

              {/* テスト実行時刻 */}
              <div className="text-sm text-muted-foreground">
                実行時刻: {new Date(testResults.timestamp).toLocaleString('ja-JP')}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
};

export default APITestPanel;