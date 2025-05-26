# 🎯 CSV駆動AI創作システム - 動作確認・テスト手順

## 📋 システム概要

**置換禁止の真のAI創作システム**を実装完了しました。Claude APIがペルソナになりきって、CSVデータに基づいて自然な口コミを一から創作します。

### 🔧 実装内容

#### ✅ 完了した機能
1. **CSV駆動動的プロンプト生成** (`buildDynamicPrompt()`)
2. **Claude API直接連携** (`callClaudeAPI()`)
3. **ペルソナ完全体現システム**
4. **品質管理・スコアリング** (`calculateQualityScore()`)
5. **フロントエンド統合** (customPrompt送信対応)

#### ❌ 削除した機能
- テンプレート置換方式
- 機械的キーワード挿入
- スクリプト処理による後処理

## 🎭 AI創作プロセス

### 1. CSV設定解析
```javascript
// 4つのCSVファイルから情報抽出
const { basicRules, humanPatterns, qaKnowledge, successExamples } = csvConfig;
```

### 2. ペルソナ選択
```javascript
// ランダムにペルソナパターンを選択
const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
```

### 3. 動的プロンプト構築
```javascript
// CSV駆動でAI創作用プロンプトを生成
const dynamicPrompt = buildDynamicPrompt(csvConfig, randomPattern, customPrompt);
```

### 4. Claude API呼び出し
```javascript
// HTTPSでClaude APIを直接呼び出し
const reviewText = await callClaudeAPI(dynamicPrompt, anthropicApiKey);
```

### 5. 品質評価
```javascript
// CSV基準で品質スコア計算
const qualityScore = calculateQualityScore(reviewText, csvConfig, randomPattern);
```

## 🧪 テスト手順

### 前提条件
1. **Netlify環境変数設定**
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-[your-key]
   ```

2. **CSVファイル準備**
   - `basic_rules.csv`: 必須要素・禁止表現
   - `human_patterns.csv`: ペルソナパターン
   - `qa_knowledge.csv`: 品質管理ルール
   - `success_examples.csv`: 理想出力例

### テスト1: システム接続確認
1. アプリにアクセス
2. 「システム接続テスト」ボタンクリック
3. ✅ 正常ステータス確認

### テスト2: CSV駆動AI創作
1. 4つのCSVファイルをアップロード
2. プロンプト編集エリアで内容確認
3. 生成件数設定（推奨: 3-5件）
4. 「レビューを生成」ボタンクリック
5. ✅ AI創作レビュー生成確認

### テスト3: 品質評価
生成されたレビューが以下を満たすか確認：

#### ✅ 成功基準
- **文字数**: 150-400文字
- **ペルソナ反映**: 年代・性格タイプに応じた文体
- **必須要素含有**: basic_rules.csvの要素が自然に配置
- **禁止表現回避**: prohibited_expressionsが含まれない
- **自然さ**: 人間が書いたような説得力
- **品質スコア**: 6.0以上

#### ❌ 失敗パターン
- テンプレート的な文章
- キーワードの羅列
- 不自然な表現
- 同伴者言及
- 機械的な構成

## 🔍 デバッグ情報

### ログ確認ポイント
```javascript
console.log('CSV駆動AI創作システム 開始');
console.log('ペルソナ:', { age_group, personality_type, vocabulary, exclamation_marks });
console.log('Claude API Success:', { textLength, preview });
console.log('AI創作完了:', { score, textLength });
```

### エラーパターン
1. **ANTHROPIC_API_KEY未設定**
   ```
   Error: ANTHROPIC_API_KEY環境変数が設定されていません
   ```

2. **Claude API呼び出しエラー**
   ```
   Error: Claude APIリクエストエラー: [詳細]
   ```

3. **品質スコア低下**
   ```
   Score < 6.0: フィルタリングで除外
   ```

## 📊 期待される出力例

### 20代 High型の例
```
池袋西口のSHOGUN BARで抹茶カクテル飲んできました！マジで絶妙な苦味と甘さのバランスで、写真映えする店内装飾も最高でした！侍のコスプレ体験もできちゃって、めちゃくちゃテンション上がりました！いつもと違うデートに絶対おすすめです！
```

### 50代 Formal型の例
```
池袋で格調高い雰囲気のSHOGUN BARを利用いたしました。将軍をテーマにした日本酒は趣があり、静かに酒と向き合える貴重な空間です。日本酒好きにおすすめです。
```

## 🚀 次のステップ

### 1. 本格運用開始
- 大量生成テスト（50-100件）
- パフォーマンス測定
- 品質安定性確認

### 2. 機能拡張
- 複数店舗対応
- カスタムCSV編集機能
- 品質フィルタリング調整

### 3. 最適化
- API呼び出し効率化
- プロンプト精度向上
- エラーハンドリング強化

---

**🎯 重要**: このシステムは置換を一切使用せず、Claude AIが完全にペルソナになりきって自然な口コミを創作します。success_examples.csvの品質レベルを目指した真のAI創作システムです。 