# 実装計画
以下では、CSV 駆動型レビュー生成エージェントの開発を段階的に進めるための **実装フェーズ** と **セキュリティ要件** をまとめます。

---
## 1. 全体アーキテクチャ

```plaintext
[Netlify Frontend]
    ↕ HTTPS + CORS制限
[Mastra Agents (Node.js/TypeScript)]
    ├─ CSVParser Agent
    ├─ DynamicPromptBuilder Agent
    ├─ ReviewGenerator Agent
    └─ QualityController Agent
    ↕ TLS
[Claude Sonnet 4 API]
    ↕ TLS
[Supabase (PostgreSQL)]
```

---
## 2. セキュリティ設計（共通）
- **秘密情報管理**
  - Supabase や Claude API キーは環境変数または Vault/AWS Secrets Manager 等で管理
  - `.env` やコミット禁止ファイルに平文で残さない
- **通信の暗号化**
  - フロント⇄バック間・バック⇄外部 API 間は必ず HTTPS/TLS
- **CORS 設定**
  - フロントエンドのオリジンのみ許可
  - 必要最小限の HTTP メソッドのみ有効化 (GET/POST)
- **認可・認証**
  - 単一ユーザー運用のため厳密なユーザー管理不要
  - ただし管理 API はシークレットトークンで保護（Header ベース）
- **入力バリデーション／サニタイズ**
  - CSV アップロード時にファイル種類・サイズ・拡張子をチェック
  - CSV 列・セルの正規表現チェック（たとえば `age_group` は `/^[0-9]+-[0-9]+$/`）
- **SQL インジェクション防止**
  - Drizzle ORM 等でパラメタライズドクエリのみ利用
  - ユーザー入力を直接 SQL に埋め込まない
- **エラーハンドリング**
  - スタックトレースや内部パスを公開しない
  - フロントには汎用的なエラーメッセージを返却し、詳細はサーバーログ
- **ヘッダー制御**
  - `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  - `Strict-Transport-Security` 設定
- **依存性管理**
  - SCA ツール（e.g. Dependabot, Snyk）を CI に組み込み
  - lockfile（`package-lock.json`）をコミット

---
## 3. 実装フェーズ

### フェーズ 1: プロジェクト基盤構築 (1 週間)
- リポジトリ構成と CI/CD パイプライン（GitHub Actions）
  - Lint／Type-Check／テスト自動実行
  - セキュリティスキャン（npm audit, Snyk）
- 環境変数管理 (dotenv + Secret Manager)
- Netlify プロジェクト作成 & HTTPS 強制
- Supabase プロジェクト作成 & 初期テーブル定義

### フェーズ 2: CSV アップロード & バリデーション (1 週間)
- Next.js + TypeScript でドラッグ＆ドロップ UI
  - ファイルサイズ・拡張子チェック
  - プレビュー画面で CSV をパース表示
- `CSVParser Agent` 実装
  - `csv-parse` ライブラリでパース
  - スキーマバリデーション（Zod / AJV）適用
  - 不正データはエラーとして返却

### フェーズ 3: プロンプト構築 & 設定UI (1 週間)
- `DynamicPromptBuilder Agent` 実装
  - age/gender 比率設定画面
  - キーワード管理画面（必須・推奨・禁止）
  - `patterns.csv` に基づくトーン調整オプション
  - UI からプロンプト微調整可能
- セキュリティ
  - UI 入力内容を再度サーバーでバリデート

### フェーズ 4: レビュー生成 & 品質管理 (2 週間)
- `ReviewGenerator Agent` 実装
  - Claude Sonnet 4 API 呼び出し（タイムアウト設定）
  - リクエスト回数制限・再試行ロジック
- `QualityController Agent` 実装
  - `quality_rules.csv` に基づく自動チェック
  - 人間らしさスコア算出ロジック (e.g. 文法多様性、AI 検知回避率)
  - 最低スコア未満は再生成 or フィルタリング
- 並列処理はキュー＋Worker 方式で制御（Mastra Framework の機能利用）

### フェーズ 5: 結果保存・ダウンロード機能 (1 週間)
- Supabase への保存処理実装
  - Prepared statement／ORM 経由で安全に挿入
- フロントから生成済みレビューの CSV ダウンロード
  - `Content-disposition: attachment` ヘッダー設定
- 個別レビュー再生成ボタン実装

### フェーズ 6: テスト & パフォーマンス最適化 (1 週間)
- ユニットテスト／E2E テスト
  - CSV パーサー、プロンプトビルダー、品質管理ロジック
- 負荷テスト：20 件生成を 2 分以内 vs CSV 処理 5 秒以内
- フロントパフォーマンス：TBT, FID を Netlify Analytics や Lighthouse でチェック

### フェーズ 7: 本番リリース & 運用監視
- 本番環境デプロイ（Netlify + Supabase Production）
- モニタリング／アラート
  - Cloudflare / Netlify Analytics
  - Supabase ログ監視
  - Claude API エラー率確認
- 定期的な依存ライブラリアップデートとセキュリティパッチ

---
## 4. 成果物と成功指標
- **機能要件**：4 つの CSV から即時に高品質レビューを生成・ダウンロード
- **パフォーマンス**：20 件生成 ＜ 2 分、CSV 処理 ＜ 5 秒、UI 応答 ＜ 0.5 秒
- **品質**：人間らしさスコア ≧ 8.0、AI 検知回避率 ≧ 95%  
- **セキュリティ**：CI による継続的スキャン、HTTPS／CSP 完全適用、入力バリデーション済

上記実装計画に沿って開発を進めてまいります。ご確認ください。