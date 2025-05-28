# Claude Code 設定 - CSV駆動口コミ生成AIエージェント

## プロジェクト概要
**CSV-Driven Review Generator Agent** - 4つのCSVファイル（keywords.csv, patterns.csv, examples.csv, quality_rules.csv）から自然で人間らしい日本語レビューを自動生成するWebアプリケーション

### 目標
- 1〜100件のレビューを数秒で生成
- 人間らしさスコア平均8.0以上を達成
- AI検知回避率95%以上を維持
- 単一ユーザーによる複数店舗設定管理

## 技術スタック

### Frontend
- **Framework**: Next.js 14 (App Router必須)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v3 + shadcn/ui
- **Hosting**: Netlify
- **UI Components**: React + shadcn/ui component library

### Backend & Agents
- **Framework**: Mastra Framework v1
- **Runtime**: Node.js v20.2.1 + TypeScript v5
- **AI Model**: Claude Sonnet 4 API (Anthropic)
- **Database**: Supabase (PostgreSQL)
- **Architecture**: 4つの専門エージェント

### 必須エージェント
1. **CSVParserAgent** - CSV解析・バリデーション
2. **DynamicPromptBuilderAgent** - 動的プロンプト構築
3. **ReviewGeneratorAgent** - Claude API呼び出し・レビュー生成
4. **QualityControllerAgent** - 品質管理・フィルタリング

## プロジェクト構造

### Next.js 14 App Router 構造
```
app/
├── layout.tsx                    # ルートレイアウト
├── page.tsx                      # ランディングページ
├── stores/page.tsx               # 店舗選択UI
├── upload/page.tsx               # CSV アップロード
├── prompt/page.tsx               # プロンプト設定
├── generate/page.tsx             # 生成設定・実行
├── api/
│   ├── generate/route.ts         # レビュー生成API
│   ├── quality/route.ts          # 品質チェックAPI
│   ├── csv/route.ts             # CSV解析API
│   └── export/route.ts          # CSV出力API
├── (ui)/                        # shadcn/ui コンポーネント
├── (agents)/                    # Mastra エージェント
└── (layout)/                    # 共通レイアウト
```

### 必須CSVファイル
- `keywords.csv` - 必須・推奨・禁止キーワード
- `patterns.csv` - 年代・性別別の語調パターン
- `examples.csv` - レビュー例文・テンプレート
- `quality_rules.csv` - 品質基準・チェックルール

## コーディング規約

### TypeScript
- **厳密性**: `strict: true`, `noImplicitAny: true`
- **モジュール**: ES modules (`import/export`) のみ
- **型定義**: `any` は CSVParser 内部のみ許可
- **インターフェース**: CSV スキーマは明確に型定義
- **エラーハンドリング**: try-catch + 型安全なエラー処理

### Next.js 14 App Router
- **Pages Router禁止**: `pages/` ディレクトリ使用不可
- **API Routes**: `app/api/[name]/route.ts` 形式のみ
- **Server Actions**: フォーム送信にはServer Actions使用
- **Component分離**: Server/Client Components を適切に分離

### Mastra Framework
- **Agent設計**: 1つのエージェント = 1つの責務
- **型安全性**: エージェントは厳密型付きペイロードを返却
- **エラー処理**: 中央集権的エラーハンドリング
- **ログ**: UIへのストリーミングログ

### Tailwind CSS
- **JIT Mode**: Just-In-Time コンパイラ使用
- **設定**: `@tailwind base`, `@tailwind components`, `@tailwind utilities`
- **カスタム**: `tailwind.config.js` でテーマ定義
- **Purge**: 本番環境で未使用スタイル削除

## パフォーマンス要件

### 必達目標
- **レビュー生成**: 20件を2分以内
- **CSV処理**: 5秒以内でアップロード・バリデーション
- **UI応答**: 0.5秒以内で操作レスポンス
- **品質スコア**: 平均8.0以上の人間らしさ

### 最適化指針
- Claude Sonnet 4 API呼び出しの最適化
- CSVParserAgent でのバッチ処理
- React Server/Client Components の適切な使い分け
- ストリーミング処理でリアルタイム進捗表示

## データフロー

### 基本フロー
```
Store Selection → CSV Upload → CSV Validation → 
Dynamic Prompt Building → Review Generation → 
Quality Check → Real-time Display → CSV Export
```

### API エンドポイント対応
- **店舗選択**: `app/stores/page.tsx`
- **CSV解析**: `app/api/csv/route.ts` → CSVParserAgent
- **プロンプト構築**: `app/prompt/page.tsx` → DynamicPromptBuilderAgent  
- **レビュー生成**: `app/api/generate/route.ts` → ReviewGeneratorAgent
- **品質管理**: `app/api/quality/route.ts` → QualityControllerAgent
- **CSV出力**: `app/api/export/route.ts`

## セキュリティ・品質要件

### セキュリティ
- **入力バリデーション**: CSVファイルの厳密なスキーマチェック
- **サニタイゼーション**: インジェクション攻撃防止
- **HTTPS**: 全通信の暗号化
- **環境変数**: API キーの安全な管理
- **CORS**: フロントエンドオリジンのみ許可

### 品質管理
- **必須キーワード**: 100%含有率確保
- **禁止表現**: 完全除外
- **自然性スコア**: 8.0以上フィルタリング
- **AI検知回避**: 95%以上の成功率

## 開発時の注意点

### CSVパーサー実装
- `csv-parse` ライブラリを使用
- スキーマバリデーションにZodまたはAJV適用
- エラーメッセージは生のエラー内容をUI表示
- ファイルサイズ・拡張子チェック必須

### Claude API統合
- **レート制限**: 指数バックオフ実装
- **ストリーミング**: トークンをUIにリアルタイム表示
- **バッチ処理**: 年代・性別分布に応じた一括処理
- **エラーハンドリング**: タイムアウト・API障害対応

### Supabase データベース
- **テーブル設計**: 
  - `generation_sessions` (セッション管理)
  - `generated_reviews` (生成レビュー)
- **クエリ**: パラメータ化クエリのみ使用
- **ストリーミング**: 大量データセット対応

## UI/UX 指針

### ユーザビリティ
- **ドラッグ&ドロップ**: 直感的なCSVアップロード
- **リアルタイム**: 進捗バー・スコア表示
- **エラー表示**: バリデーションエラーの即座表示
- **レスポンシブ**: モバイル・タブレット対応

### shadcn/ui 活用
- **コンポーネント**: 一貫性のあるUI部品使用
- **バリアント**: component variant パターン準拠
- **テーマ**: `ThemeProvider` + `Toaster` でラップ
- **アクセシビリティ**: ARIA ラベル・フォーカス状態

## テスト戦略

### 必須テスト
- **ユニットテスト**: 各エージェントの動作検証
- **統合テスト**: CSV → レビュー生成の完全フロー
- **E2Eテスト**: ブラウザでの操作シナリオ
- **パフォーマンステスト**: 目標時間内での処理完了

### テストケース
- 正常なCSVファイルでの完全フロー
- 不正なCSVでのエラーハンドリング
- API障害時の回復処理
- 大量生成時のパフォーマンス

## Claude へのお願い

### 実装スタイル
- **段階的実装**: Phase 1〜7の順序で開発進行
- **エージェント分離**: 各エージェントは独立して動作
- **型安全性重視**: TypeScript の型システムを最大活用
- **エラー処理**: ユーザーフレンドリーなエラーメッセージ

### コード品質
- **可読性**: 日本語コメント歓迎
- **再利用性**: 共通ロジックの適切な抽象化  
- **保守性**: 将来の機能拡張を考慮した設計
- **パフォーマンス**: 要件を満たす最適化実装

### 日本語対応
- **UI文言**: 日本語UI（エラーメッセージ含む）
- **レビュー生成**: 自然な日本語表現
- **CSV処理**: 日本語文字列の適切な処理
- **データベース**: UTF-8対応