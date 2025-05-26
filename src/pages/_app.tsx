/**
 * @file _app.tsx
 * @description Next.jsアプリケーションのルートコンポーネント
 * 主な機能：Tailwind CSS読み込み、グローバル設定、型安全
 * 制限事項：Netlify/Next.js構成、TypeScript対応
 */
import type { AppProps } from 'next/app';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
} 