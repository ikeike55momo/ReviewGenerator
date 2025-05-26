# 🤖 CSV駆動口コミ生成エージェント

4つのCSVファイルを投入するだけで、その店舗・業種に特化した自然で人間らしい口コミを自動生成するエージェントシステム。

## ✨ 特徴

- **Zero-Code Configuration**: CSVファイルの更新のみで新規店舗対応
- **AI判定回避**: 人間らしい自然な文章生成（平均品質スコア8.0+）
- **年代・性別対応**: リアルな世代差・性差の表現を自動生成
- **Claude Code × GitHub Actions**: 要件変更時の自動開発フロー

## 🏗️ 技術スタック

- **エージェント**: Mastra Framework
- **AI**: Claude Sonnet 4 API
- **フロントエンド**: Next.js + TypeScript
- **データベース**: Supabase
- **デプロイ**: Netlify
- **自動開発**: GitHub Actions + Claude Code API

## 🚀 クイックスタート

### 1. セットアップ
```bash
git clone https://github.com/ikeike55momo/ReviewGenerator.git
cd ReviewGenerator
npm install
```

### 2. 環境変数設定
```bash
cp .env.example .env
# .env ファイルにAPI キーを設定
```

### 3. サンプル実行（SHOGUN BAR例）
```bash
npm run dev
```

## 📊 CSV設定例（SHOGUN BAR）

### keywords.csv
```csv
category,keyword,priority,usage_rule,example
area,池袋,必須,1回以上使用,池袋で本格的な日本酒を
business,SHOGUN BAR,必須,1回使用,SHOGUN BARで一人飲み
usp,抹茶カクテル,高,1回以上推奨,抹茶カクテルが絶品で
```

### patterns.csv
```csv
age_group,gender,tone,vocabulary,example_phrases
20s,female,high,"めちゃくちゃ,マジで,ヤバい","テンション上がる！,映える"
30s,male,medium,"とても,かなり,想像以上","満足できました,印象的"
```

## 🤖 Claude Code 自動開発

このプロジェクトは **Claude Code × GitHub Actions** による自動開発に対応：

- `requirements/` 更新 → 自動でエージェント実装更新
- `sample-csv/` 変更 → 自動でロジック調整
- GitHub Actions で Phase 1-4 の段階的開発

### 手動トリガー
1. GitHub Actions タブを開く
2. "Claude Code Auto Development" を実行
3. Phase選択（1-4）で段階的開発

## 📁 プロジェクト構造

```
ReviewGenerator/
├── requirements/          # 詳細要件定義
├── sample-csv/           # サンプル設定（SHOGUN BAR例）
├── src/
│   ├── agents/          # Mastraエージェント
│   ├── types/           # TypeScript型定義
│   └── components/      # React コンポーネント
├── .github/workflows/   # 自動開発ワークフロー
└── README.md
```

## 🎯 使用方法

### 基本フロー
1. **CSV準備**: 4つのCSVファイルを準備
   - `keywords.csv`: キーワード設定
   - `patterns.csv`: 年代別文体パターン  
   - `examples.csv`: 成功例テンプレート
   - `quality_rules.csv`: 品質チェックルール

2. **生成実行**: Webインターフェースでアップロード・実行

3. **結果取得**: 自然な口コミをCSV形式でダウンロード

### 新規店舗対応
1. 既存のサンプルCSVをコピー
2. 店舗情報に合わせて内容を変更
3. システムにアップロード → 即座に対応完了

## 📈 品質保証

- **品質スコア**: 平均8.0点以上
- **AI判定回避率**: 95%以上
- **必須要素充足率**: 100%
- **自然さ**: 年代・性別に応じた適切な文体

## 🔧 開発・拡張

### ローカル開発
```bash
npm run dev        # 開発サーバー起動
npm run build      # プロダクションビルド
npm run agents     # エージェント単体テスト
```

### 要件変更時の自動開発
1. `requirements/` フォルダ内のマークダウンを更新
2. GitHub にプッシュ
3. Claude Code API が自動で実装を更新

## 📚 詳細ドキュメント

- [詳細要件定義](./requirements/) - 完全な仕様書
- [実装計画](./requirements/implementation_plan.md) - 開発ロードマップ
- [技術仕様](./requirements/tech_stack_document.md) - 技術詳細

## 🤝 コントリビューション

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 ライセンス

MIT License

## 🙋‍♂️ サポート

質問や問題がある場合は、[Issues](https://github.com/ikeike55momo/ReviewGenerator/issues) を作成してください。

---

**「CSVを4つ投げるだけで、その店舗の自然な口コミが生成される」** - それがこのシステムの本質です。
