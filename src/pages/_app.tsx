/**
 * @file _app.tsx
 * @description Next.jsアプリケーションのルートコンポーネント（shadcn/ui + ErrorBoundary対応）
 * 主な機能：Tailwind CSS読み込み、グローバル設定、エラーハンドリング、型安全
 * 制限事項：Netlify/Next.js構成、TypeScript対応
 */
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import ErrorBoundary from '../components/ErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // エラーログの記録や外部サービスへの送信
        console.error('App Error:', error, errorInfo);
      }}
    >
      <Component {...pageProps} />
    </ErrorBoundary>
  );
} "/* Force cache clear */"  
