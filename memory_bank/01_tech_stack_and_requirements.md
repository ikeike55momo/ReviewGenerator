# 技術スタック・全体要件・開発方針まとめ

## 技術スタック（Tech Stack）
- **フロントエンド**: Next.js（React + TypeScript）、Tailwind CSS、shadcn/ui、Netlify（ホスティング）
- **バックエンド**: Mastra Framework（Node.js + TypeScript）、Anthropic Claude Sonnet 4 API、Supabase（PostgreSQL）
- **インフラ・CI/CD**: GitHub、Netlify CI/CD、Supabase
- **サードパーティ連携**: Anthropic、Supabase、Netlify

## セキュリティ・パフォーマンス要件
- HTTPS通信、CORS制限、APIキーの安全管理、CSVバリデーション、DB権限制御
- グローバルCDN、サーバーレススケーリング、非同期処理、効率的なDBクエリ

## プロジェクト全体要件
- 4つのCSV（keywords, patterns, examples, quality_rules）から即時に高品質なレビューを生成
- 1回で1～100件のレビュー生成、平均人間らしさスコア8.0以上、AI検知回避率95%以上
- ストア選択・CSVアップロード・バリデーション・動的プロンプト生成・バッチレビュー生成・品質管理・ダウンロード
- UIはドラッグ＆ドロップ、リアルタイム進捗表示、個別再生成、CSVダウンロード

## 開発フェーズ（実装計画）
1. プロジェクト基盤構築（リポジトリ、CI/CD、環境変数、初期DB）
2. フロントエンド（UI設計、CSVアップロード、プレビュー、設定UI）
3. バックエンド（CSVパース、プロンプト生成、レビュー生成、品質管理、API設計）
4. 統合・テスト（E2E、パフォーマンス、品質検証）
5. デプロイ・運用監視

## フロントエンド設計指針
- Next.js + TypeScript、Tailwind CSS、shadcn/ui
- アクセシビリティ・レスポンシブ・一貫性重視
- コンポーネント分割、React Query、Context API活用
- ユニット・E2Eテスト、CIで自動検証

## バックエンド設計指針
- Mastra Frameworkでエージェント分離（CSVParser, PromptBuilder, ReviewGenerator, QualityController）
- Supabaseでセッション・レビュー管理
- ExpressサーバーでAPI設計、CORS・エラーハンドリング
- セキュリティ・パフォーマンス最適化

---

次のステップ：
- フェーズ1「プロジェクト基盤構築」から順次着手し、各機能ごとに進捗記録をmemory_bankへ出力します。 