# CSV駆動型レビュー生成AIエージェント - Memory Bank

## プロジェクト概要
CSV駆動型レビュー生成エージェントの開発。4つのCSVファイル（basicRules, humanPatterns, qaKnowledge, successExamples）をアップロードし、AIで高品質な日本語レビューを自動生成するWebアプリケーション。

## 技術スタック
- **フロントエンド**: Next.js + React + TypeScript、Tailwind CSS
- **デプロイ**: Netlify
- **バックエンド**: Netlify Functions
- **AI**: Claude API（Anthropic）
- **データベース**: Supabase PostgreSQL

## 重要な要件定義

### CSV出力形式の詳細要件
**出力CSV形式**: success_examples.csv形式に完全準拠
```csv
review,age,gender,companion,word,recommend
```

**各列の詳細仕様**:
1. **review**: 生成されたレビューテキスト（ダブルクォートエスケープ済み）
2. **age**: レビュアー年齢（例：20代、30代）
3. **gender**: レビュアー性別（男性、女性、その他）
4. **companion**: 同伴者（常に「一人」- 個人体験のみ）
5. **word**: 使用されたキーワード（バーティカルライン区切り）
   - basic_rules.csvから選択されたワードを全て含める
   - 形式例：`池袋|バー|抹茶カクテル|アクセス抜群|日本文化`
6. **recommend**: 使用された推奨フレーズ
   - basic_rules.csvのrecommendation_phrasesから選択されたもの
   - 例：`日本酒好きに`

### word列の構成要素
basic_rules.csvから以下の要素を抽出してバーティカルライン区切りで結合：
- **エリア** (required_elements/area): 必ず1つ
- **業種** (required_elements/business_type): 必ず1つ  
- **USP** (required_elements/usp): 文字数に応じて1-3個
- **環境** (required_elements/environment): 必ず1つ
- **サブ要素** (required_elements/sub): 0-2個（自然さ重視）

### AI創作の絶対禁止事項
- **置換は絶対に禁止** - スクリプトやテンプレート置換は一切使用しない
- **AI自身による創作** - Claude APIがペルソナになりきって自然な口コミを一から創作
- **絵文字完全禁止** - 😊🎉✨等の絵文字は一切使用しない
- **非現実的内容禁止** - 日本刀・抜刀術・武術等の言及は即座に削除

### 文字数制御の重み付け
150-400文字範囲で短文重視：
- 40%の確率で150-200文字（短文）
- 30%の確率で201-250文字（中短文）
- 20%の確率で251-300文字（中文）
- 10%の確率で301-400文字（長文）

## 実装完了内容

### 1. プロジェクト構造・設定
- `netlify.toml`: Netlify Functions設定、リダイレクト設定
- `next.config.js`: Next.js設定（target削除でビルドエラー解決）
- `tailwind.config.js`: 日本語フォント、カスタムカラー設定
- `package.json`: Next.js用スクリプト、依存関係管理
- `.gitignore`: Next.js対応版

### 2. UIコンポーネント実装
- **`src/pages/index.tsx`**: メインページ、CSVアップロード→レビュー生成→結果表示の一連フロー
- **`src/components/CSVUploader.tsx`**: 4つのCSV個別アップロード、ドラッグ&ドロップ、即時プレビュー、スキーマバリデーション
- **`src/components/ReviewGenerator.tsx`**: 生成件数スライダー（1-100件）、メインPrompt編集機能
- **`src/components/ReviewList.tsx`**: 生成結果一覧、品質スコア表示・色分け、CSVダウンロード
- **`src/components/BatchManager.tsx`**: バッチ管理コンポーネント

### 3. API実装
- **`src/pages/api/generate-reviews.ts`**: Next.js APIルート、Claude API連携、CSV駆動動的プロンプト生成、データベース保存対応
- **`src/pages/api/batch-generate.ts`**: バッチ生成専用API
- **`src/pages/api/batch-history.ts`**: バッチ履歴管理・CSV一括出力API
- **`netlify-functions/generate-reviews.js`**: Netlify Functions用実装

### 4. 型定義
- **`src/types/csv.ts`**: CSV構造の型定義
- **`src/types/review.ts`**: レビュー関連の型定義（データベース連携対応に更新）

### 5. データベース設計・実装
- **`src/config/database.sql`**: 6テーブルの完全スキーマ
- **`src/utils/database.ts`**: データベース操作ユーティリティ
- **環境変数設定**: Supabase接続情報

## 最新の修正対応（CSV出力形式修正）

### 修正内容
1. **レビュー生成API修正** (`src/pages/api/generate-reviews.ts`)
   - 使用キーワードの追跡：生成時に使用されたキーワード（エリア、業種、USP、環境、サブ要素）をバーティカルライン区切りで保存
   - 推奨フレーズの追跡：使用された推奨フレーズを保存
   - generationParametersに`usedWords`と`selectedRecommendation`を追加

2. **ReviewListコンポーネント修正** (`src/components/ReviewList.tsx`)
   - CSV出力形式をsuccess_examples.csv形式に変更
   - 新しいGeneratedReview型定義に対応
   - word列：バーティカルライン区切りのキーワード出力
   - recommend列：使用された推奨フレーズ出力

3. **バッチ履歴API修正** (`src/pages/api/batch-history.ts`)
   - CSV出力機能をsuccess_examples.csv形式に統一
   - 同様のword列・recommend列出力対応

### 出力例
```csv
review,age,gender,companion,word,recommend
"池袋のバーで友人と過ごした夜、抹茶カクテルの美味しさに驚きました！一口飲むとふわっと香りが広がり、まるで和のデザートのよう。アクセス抜群の立地で、待ち合わせにも便利です。日本文化を感じる内装も素敵で、心まで癒されました。日本酒好きにぴったりのお店です！",20代,男性,一人,池袋|バー|抹茶カクテル|アクセス抜群|日本文化,日本酒好きに
```

## 環境変数設定
- ANTHROPIC_API_KEY: Claude API接続用
- SUPABASE_URL: データベース接続用
- SUPABASE_ANON_KEY: データベース認証用

## 現在の状況
- 開発サーバーが起動中（http://localhost:3000）
- 単発生成モード・バッチ生成モード両方利用可能
- データベース連携完了、バッチ管理システム実装完了
- CSV出力形式修正完了（success_examples.csv形式準拠）
- 文字数重み付け調整・絵文字禁止・現実的内容制限すべて適用済み
- 100件×5回=500件の分割生成・履歴管理・CSV一括出力機能が利用可能 