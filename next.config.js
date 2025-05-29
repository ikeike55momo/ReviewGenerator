/**
 * @file next.config.js
 * @description Next.js設定ファイル（Vercel対応）
 * 主な機能：Vercel最適化、TypeScript設定、ビルド設定
 * 制限事項：Vercel/Next.js構成、環境変数管理
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
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

  // 画像最適化（Vercel対応）
  images: {
    unoptimized: false,
  },

  // 実験的機能（Vercel対応）
  experimental: {
    // Server Components用外部パッケージ設定（Next.js 14対応）
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },

  // ビルド設定（Windows権限問題対応）
  distDir: '.next',
  
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

    // Windows権限問題対応：ファイルシステム操作の最適化
    if (!dev) {
      config.cache = false;
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