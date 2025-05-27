# 🚀 Netlify → Vercel 移行ガイド

## 📋 移行前チェックリスト

- [ ] Vercelアカウント作成
- [ ] 環境変数一覧確認
- [ ] カスタムドメイン情報確認
- [ ] 現在のビルド設定確認

## 🔧 Step 1: Vercelプロジェクト作成

### 1.1 GitHubリポジトリ連携
```bash
# Vercel CLIインストール
npm i -g vercel

# プロジェクト初期化
vercel

# 設定選択
? Set up and deploy "csv-reviewgenerator"? [Y/n] y
? Which scope do you want to deploy to? [your-account]
? Link to existing project? [y/N] n
? What's your project's name? csv-reviewgenerator
? In which directory is your code located? ./
? Want to override the settings? [y/N] n
```

### 1.2 自動検出される設定
- ✅ Framework: Next.js
- ✅ Build Command: `npm run build`
- ✅ Output Directory: `.next`
- ✅ Install Command: `npm install`

## 🔧 Step 2: 環境変数設定

### 2.1 Netlifyから環境変数エクスポート
```bash
# Netlify CLI（必要に応じて）
netlify env:list

# 手動でコピー
CLAUDE_API_KEY=your_key_here
```

### 2.2 Vercelに環境変数設定
```bash
# CLI経由
vercel env add CLAUDE_API_KEY

# または Dashboard経由
# https://vercel.com/[your-account]/csv-reviewgenerator/settings/environment-variables
```

## 🔧 Step 3: Vercel最適化設定

### 3.1 vercel.json作成/更新
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "src/pages/api/generate-reviews*.ts": {
      "maxDuration": 300,
      "memory": 3009
    }
  },
  "regions": ["nrt1"],
  "crons": []
}
```

### 3.2 Next.js設定最適化
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Vercel最適化
  experimental: {
    // 必要に応じて
  },
  
  // 画像最適化
  images: {
    domains: ['your-domain.com'],
  },
}

module.exports = nextConfig
```

## 🔧 Step 4: パフォーマンス最適化

### 4.1 Fluid Compute有効化
1. Vercel Dashboard → Settings → Functions
2. "Fluid Compute" を有効化
3. 再デプロイ

### 4.2 メモリ設定最適化
```typescript
// src/pages/api/generate-reviews.ts
export const config = {
  maxDuration: 300, // 5分
  memory: 3009,     // 最大メモリ
};
```

## 🔧 Step 5: ドメイン移行

### 5.1 カスタムドメイン追加
```bash
# CLI経由
vercel domains add your-domain.com

# DNS設定
# A record: 76.76.19.61
# CNAME: cname.vercel-dns.com
```

### 5.2 SSL証明書
- ✅ 自動発行・更新
- ✅ Let's Encrypt使用
- ✅ 設定不要

## 🔧 Step 6: 段階的移行

### 6.1 テスト環境での確認
```bash
# プレビューデプロイ
vercel --prod=false

# 本番デプロイ
vercel --prod
```

### 6.2 DNS切り替え
1. TTL短縮（1時間程度）
2. DNS切り替え
3. 動作確認
4. Netlifyプロジェクト削除

## 📊 移行後の確認項目

### 6.1 機能テスト
- [ ] レビュー生成（1件）
- [ ] レビュー生成（複数件）
- [ ] エラーハンドリング
- [ ] タイムアウト動作

### 6.2 パフォーマンステスト
- [ ] 応答速度
- [ ] メモリ使用量
- [ ] 実行時間
- [ ] 同時実行

## 🎯 期待される改善効果

| 項目 | Netlify | Vercel | 改善率 |
|------|---------|--------|--------|
| メモリ | 1024MB | 3009MB | **+194%** |
| タイムアウト | 26秒 | 300秒 | **+1054%** |
| 同時実行 | 1000 | 30000+ | **+2900%** |
| バンドルサイズ | 50MB | 250MB | **+400%** |

## 🚨 注意事項

1. **環境変数**: 必ず移行前に確認
2. **ドメイン**: DNS切り替えタイミング注意
3. **料金**: Pro プラン推奨（$20/月）
4. **モニタリング**: 移行後1週間は監視

## 📞 サポート

- Vercel公式ドキュメント: https://vercel.com/docs
- Next.js公式ドキュメント: https://nextjs.org/docs
- コミュニティサポート: Discord, GitHub Discussions 