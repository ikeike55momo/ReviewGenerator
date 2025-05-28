/**
 * @file _app.tsx
 * @description Next.jsアプリケーションのルートコンポーネント
 * 主な機能：Tailwind CSS読み込み、グローバル設定、型安全、エラーバウンダリ
 * 制限事項：Netlify/Next.js構成、TypeScript対応
 */
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import ErrorBoundary from '../components/ErrorBoundary';

// グローバルエラーハンドラー
function handleGlobalError(error: Error, errorInfo: React.ErrorInfo) {
  console.error('Global Error Boundary caught an error:', error, errorInfo);
  
  // 本番環境でのエラー報告
  if (process.env.NODE_ENV === 'production') {
    // TODO: エラートラッキングサービス（Sentry等）への送信
    console.error('Production error reported:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary onError={handleGlobalError}>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
} 