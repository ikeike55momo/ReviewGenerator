/**
 * @file api-test.tsx
 * @description API動作確認テストページ
 * 主な機能：API動作確認、エラーバウンダリテスト、shadcn/ui動作確認
 * 制限事項：開発環境でのみ使用
 */

import React from 'react';
import Head from 'next/head';
import APITestPanel from '../components/APITestPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';

const APITestPage: React.FC = () => {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Head>
          <title>API動作確認テスト - Review Generator</title>
          <meta name="description" content="API動作確認およびshadcn/ui統合テスト" />
        </Head>

        <div className="container mx-auto p-6 space-y-8">
          {/* ページヘッダー */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">API動作確認テスト</h1>
            <p className="text-xl text-muted-foreground">
              新統合APIエンドポイントとshadcn/ui統合の動作確認
            </p>
          </div>

          {/* 開発環境警告 */}
          {process.env.NODE_ENV === 'development' ? (
            <Alert>
              <AlertTitle>開発環境</AlertTitle>
              <AlertDescription>
                このページは開発環境でのみ表示されます。本番環境では利用できません。
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="warning">
              <AlertTitle>本番環境</AlertTitle>
              <AlertDescription>
                このページは開発環境でのみ使用することを推奨します。
              </AlertDescription>
            </Alert>
          )}

          {/* shadcn/ui動作確認セクション */}
          <Card>
            <CardHeader>
              <CardTitle>shadcn/ui統合確認</CardTitle>
              <CardDescription>
                shadcn/uiコンポーネントが正常に動作していることを確認
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Alert>
                  <AlertTitle>基本スタイル</AlertTitle>
                  <AlertDescription>デフォルトアラート表示</AlertDescription>
                </Alert>
                
                <Alert variant="destructive">
                  <AlertTitle>エラースタイル</AlertTitle>
                  <AlertDescription>エラーアラート表示</AlertDescription>
                </Alert>
                
                <Alert variant="success">
                  <AlertTitle>成功スタイル</AlertTitle>
                  <AlertDescription>成功アラート表示</AlertDescription>
                </Alert>
              </div>
              
              <div className="text-sm text-muted-foreground">
                ✅ shadcn/uiコンポーネントが正常に表示されています
              </div>
            </CardContent>
          </Card>

          {/* エラーバウンダリテストセクション */}
          <Card>
            <CardHeader>
              <CardTitle>エラーバウンダリ確認</CardTitle>
              <CardDescription>
                エラーバウンダリが正常に動作していることを確認
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTitle>エラーハンドリング</AlertTitle>
                <AlertDescription>
                  エラーバウンダリが適用されており、予期しないエラーが発生した場合は
                  ユーザーフレンドリーなエラー画面が表示されます。
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* APIテストパネル */}
          <APITestPanel />

          {/* フッター */}
          <div className="text-center text-sm text-muted-foreground">
            <p>CSV駆動口コミ生成AIエージェント - 統合テストページ</p>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default APITestPage;