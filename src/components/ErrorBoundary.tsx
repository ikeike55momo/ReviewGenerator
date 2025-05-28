/**
 * @file ErrorBoundary.tsx
 * @description React Error Boundary コンポーネント
 * エラーのキャッチ、ログ記録、フォールバックUI表示を担当
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorId: ''
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // エラーIDを生成（ログ追跡用）
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラーログ記録
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // カスタムエラーハンドラーを呼び出し
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 本番環境でのエラー報告（例：Sentry、LogRocket等）
    if (process.env.NODE_ENV === 'production') {
      // TODO: 本番環境でのエラー報告サービス統合
      console.error(`[${this.state.errorId}] Production Error:`, {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: ''
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // カスタムフォールバックUIが提供されている場合
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのエラーUI
      return (
        <Card className="max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle className="text-destructive">
              🚨 エラーが発生しました
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTitle>予期しないエラー</AlertTitle>
              <AlertDescription>
                アプリケーションでエラーが発生しました。
                下記のボタンで再試行するか、ページを再読み込みしてください。
              </AlertDescription>
            </Alert>

            {/* 開発環境でのエラー詳細表示 */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-4 p-4 bg-muted rounded-md">
                <h4 className="font-medium text-sm mb-2">エラー詳細（開発環境）:</h4>
                <pre className="text-xs text-muted-foreground overflow-x-auto">
                  {this.state.error.message}
                </pre>
                {this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer hover:text-foreground">
                      スタックトレース
                    </summary>
                    <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="default">
                再試行
              </Button>
              <Button onClick={this.handleReload} variant="outline">
                ページ再読み込み
              </Button>
            </div>

            {/* エラーID表示（サポート用） */}
            <div className="text-xs text-muted-foreground">
              エラーID: {this.state.errorId}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * API エラー専用のErrorBoundary
 */
export class APIErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorId: ''
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    const errorId = `API_ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('APIErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: ''
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>API エラー</AlertTitle>
          <AlertDescription className="mt-2">
            サーバーとの通信でエラーが発生しました。
            ネットワーク接続を確認して再試行してください。
            <div className="mt-2">
              <Button size="sm" onClick={this.handleRetry} variant="outline">
                再試行
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * レビュー生成専用のErrorBoundary
 */
export class ReviewGenerationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorId: ''
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    const errorId = `REVIEW_ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ReviewGenerationErrorBoundary caught an error:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: ''
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              レビュー生成エラー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                レビューの生成中にエラーが発生しました。
                CSV設定やAPI設定を確認して再試行してください。
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button onClick={this.handleRetry} size="sm">
                レビュー生成を再試行
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;