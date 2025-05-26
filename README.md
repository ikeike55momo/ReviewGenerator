# CSV駆動型レビュー生成エージェント

4つのCSVファイルから高品質な日本語レビューを自動生成するWebアプリケーション

## 🚀 概要

このプロジェクトは、CSV形式のデータを活用してAIが自然で説得力のある日本語レビューを生成するシステムです。Mastraエージェントフレームワークを使用し、Claude APIによる高品質なテキスト生成を実現しています。

### 主な機能

- **4種類のCSVファイル対応**
  - `basic_rules.csv`: 基本ルール・ガイドライン
  - `human_patterns.csv`: 人間らしい表現パターン
  - `qa_knowledge.csv`: Q&A知識ベース
  - `success_examples.csv`: 成功事例・参考例

- **高品質レビュー生成**
  - 1-100件の一括生成
  - 年齢・性別分布の調整
  - 品質スコアによる自動フィルタリング
  - カスタムプロンプト対応

- **直感的なWebUI**
  - ドラッグ&ドロップでCSVアップロード
  - リアルタイムプレビュー・バリデーション
  - 生成結果の一覧表示・フィルタリング
  - CSVダウンロード機能

## 🛠 技術スタック

### フロントエンド
- **Next.js 14** - React フレームワーク
- **TypeScript** - 型安全な開発
- **Tailwind CSS** - モダンなスタイリング
- **React Dropzone** - ファイルアップロード

### バックエンド
- **Mastra** - エージェントフレームワーク
- **Claude API (Anthropic)** - AI テキスト生成
- **Supabase** - データベース・認証
- **Netlify Functions** - サーバーレス API

### 開発・デプロイ
- **Netlify** - ホスティング・CI/CD
- **GitHub** - バージョン管理
- **ESLint + TypeScript** - コード品質

## 📁 プロジェクト構造

```
csv-reviewgenerator/
├── src/
│   ├── agents/                 # Mastraエージェント
│   │   ├── CSVParserAgent.ts
│   │   ├── DynamicPromptBuilderAgent.ts
│   │   ├── ReviewGeneratorAgent.ts
│   │   └── QualityControllerAgent.ts
│   ├── components/             # Reactコンポーネント
│   │   ├── CSVUploader.tsx
│   │   ├── ReviewGenerator.tsx
│   │   └── ReviewList.tsx
│   ├── pages/                  # Next.jsページ
│   │   ├── api/               # APIエンドポイント
│   │   ├── _app.tsx
│   │   └── index.tsx
│   ├── types/                  # TypeScript型定義
│   ├── utils/                  # ユーティリティ
│   ├── config/                 # 設定ファイル
│   └── styles/                 # スタイル
├── sample-csv/                 # サンプルCSVファイル
├── scripts/                    # セットアップスクリプト
├── netlify.toml               # Netlify設定
├── next.config.js             # Next.js設定
└── package.json
```

## 🚀 セットアップ・実行

### 1. 環境準備

```bash
# リポジトリクローン
git clone https://github.com/ikeike55momo/ReviewGenerator.git
cd csv-reviewgenerator

# 依存関係インストール
npm install
```

### 2. 環境変数設定

`.env.local` ファイルを作成：

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Claude API設定
ANTHROPIC_API_KEY=your-claude-api-key

# 開発環境設定
NODE_ENV=development
```

### 3. データベースセットアップ

Supabaseダッシュボードで `src/config/database.sql` を実行：

```bash
# または、セットアップスクリプト実行
node scripts/setup-database.js
```

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセス

### 5. システムテスト

Webアプリの「システム接続テスト」ボタンで各コンポーネントの動作確認

## 📊 CSVファイル形式

### basic_rules.csv
```csv
category,type,content
商品評価,ポジティブ,商品の品質が期待以上でした
商品評価,ネガティブ,期待していたほどではありませんでした
```

### human_patterns.csv
```csv
age_group,gender,personality_type,vocabulary_level,expression_style
20-30,female,enthusiastic,casual,感情豊か
40-50,male,analytical,formal,論理的
```

### qa_knowledge.csv
```csv
question,answer,category
配送はどのくらいかかりますか,通常2-3日で配送されます,配送
返品は可能ですか,30日以内であれば返品可能です,返品
```

### success_examples.csv
```csv
rating,review_text,reviewer_profile
5,とても満足しています。品質も良く、配送も早かったです。,30代女性
4,概ね満足ですが、もう少し安ければ良かったです。,40代男性
```

## 🔧 開発・デプロイ

### 型チェック
```bash
npm run type-check
```

### ビルド
```bash
npm run build
```

### Netlifyデプロイ
```bash
# 自動デプロイ（GitHubプッシュ時）
git push origin main

# 手動デプロイ
npm run netlify-build
```

## 📈 パフォーマンス要件

- **レビュー生成**: 20件/2分以内
- **CSV処理**: 5秒以内
- **UI応答**: 0.5秒以内
- **品質スコア**: 6.0/10以上で自動承認

## 🔒 セキュリティ

- 環境変数による機密情報管理
- Supabase Row Level Security (RLS)
- CORS設定によるAPI保護
- CSVファイルのバリデーション

## 🐛 トラブルシューティング

### よくある問題

1. **環境変数エラー**
   - `.env.local` ファイルの設定確認
   - Netlify環境変数の設定確認

2. **データベース接続エラー**
   - Supabase URLとキーの確認
   - データベーステーブルの作成確認

3. **Claude API エラー**
   - APIキーの有効性確認
   - レート制限の確認

### デバッグ方法

```bash
# システム接続テスト
curl http://localhost:3000/api/test-connection

# ログ確認
npm run dev # 開発サーバーのログ確認
```

## 📝 ライセンス

MIT License

## 🤝 コントリビューション

1. フォークしてブランチ作成
2. 機能追加・バグ修正
3. テスト実行
4. プルリクエスト作成

## 📞 サポート

- GitHub Issues: バグ報告・機能要望
- Email: support@example.com

---

**開発者**: ikeike55momo  
**最終更新**: 2024年1月  
**バージョン**: 1.0.0
