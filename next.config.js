/**
 * @file next.config.js
 * @description Next.js設定ファイル（Netlify Functions対応）
 * 主な機能：Netlify最適化、TypeScript設定、ビルド設定
 * 制限事項：Netlify/Next.js構成、環境変数管理
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14では target プロパティは廃止（自動でserverless）
  
  // TypeScript設定
  typescript: {
    // 型チェックエラーでもビルドを継続（開発時のみ）
    ignoreBuildErrors: false,
  },

  // ESLint設定
  eslint: {
    // ESLintエラーでもビルドを継続（開発時のみ）
    ignoreDuringBuilds: false,
  },

  // 環境変数設定
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },

  // 画像最適化（Netlifyでは無効化）
  images: {
    unoptimized: true,
  },

  // 実験的機能（Netlify対応）
  experimental: {
    // Server Components用外部パッケージ設定（Next.js 14対応）
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },

  // 出力設定（Netlify対応）
  // output: 'export', // 一時的に無効化（API Routes使用のため）
  // trailingSlash: true, // 一時的に無効化（API Routes使用のため）
  
  // Webpack設定のカスタマイズ
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Node.js polyfills for browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        buffer: require.resolve('buffer'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
      };
      
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
    }

    return config;
  },

  // ヘッダー設定（CORS対応）
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // リダイレクト設定
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig; 