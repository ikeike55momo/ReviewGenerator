/**
 * @file generate-reviews.js
 * @description Netlify Functions用レビュー生成APIエンドポイント
 * 純粋JavaScript実装でTypeScript依存関係を回避
 */

// 必要なライブラリをインポート
const { Anthropic } = require('@anthropic-ai/sdk');

// Netlify Functions用のエクスポート
exports.handler = async (event, context) => {
  // CORSヘッダー設定
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONSリクエスト（プリフライト）の処理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // POSTメソッドのみ許可
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // リクエストボディをパース
    const requestBody = JSON.parse(event.body || '{}');
    const { csvConfig, reviewCount } = requestBody;

    // 入力バリデーション
    if (!csvConfig || !reviewCount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'csvConfigとreviewCountは必須です',
          details: { csvConfig: !!csvConfig, reviewCount: !!reviewCount }
        }),
      };
    }

    if (reviewCount < 1 || reviewCount > 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'reviewCountは1～100の範囲で指定してください',
          details: { reviewCount }
        }),
      };
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY環境変数が設定されていません');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'サーバー設定エラー: APIキーが設定されていません' 
        }),
      };
    }

    // Anthropic APIクライアント初期化
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey,
    });

    // レビュー生成
    const generatedReviews = [];
    
    for (let i = 0; i < reviewCount; i++) {
      try {
        // ランダムにパターンを選択
        const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
        
        // プロンプト生成
        const prompt = generatePrompt(csvConfig, randomPattern);
        
        // Claude APIでレビュー生成
        const message = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });

        const reviewText = message.content[0].text;
        
        // 品質スコア計算
        const qualityScore = calculateQualityScore(reviewText, csvConfig, randomPattern);
        
        generatedReviews.push({
          text: reviewText,
          score: qualityScore,
          metadata: {
            age_group: randomPattern.age_group,
            personality_type: randomPattern.personality_type,
            generated_at: new Date().toISOString()
          }
        });

        console.log(`レビュー ${i + 1}/${reviewCount} 生成完了 (スコア: ${qualityScore})`);
      } catch (error) {
        console.error(`レビュー ${i + 1} 生成エラー:`, error);
        
        // エラーの詳細をログ出力
        if (error.status) {
          console.error(`Claude API Error - Status: ${error.status}, Type: ${error.error?.type}`);
        }
        
        // エラー時はスキップ（品質を保つため）
        console.log(`レビュー ${i + 1} をスキップしました`);
        continue;
      }
    }

    // 品質フィルタリング（スコア6.0未満を除外）
    const filteredReviews = generatedReviews.filter(review => review.score >= 6.0);

    console.log(`生成完了 - 総数: ${generatedReviews.length}, フィルタ後: ${filteredReviews.length}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(filteredReviews),
    };

  } catch (error) {
    console.error('Netlify Function Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'レビュー生成中に予期しないエラーが発生しました',
        details: error.message,
      }),
    };
  }
};

/**
 * プロンプト生成関数
 */
function generatePrompt(csvConfig, pattern) {
  const { basicRules } = csvConfig;
  
  // 必須要素を抽出
  const requiredElements = basicRules
    .filter(rule => rule.category === 'required_elements')
    .map(rule => rule.content);

  // 禁止表現を抽出
  const prohibitedExpressions = basicRules
    .filter(rule => rule.category === 'prohibited_expressions')
    .map(rule => rule.content);

  return `🎯 CSV駆動自然口コミ生成システム

あなたは実際にSHOGUN BAR（池袋西口のエンタメバー）を利用した${pattern.age_group}の${pattern.personality_type}な性格の顧客です。
実体験に基づいた自然で説得力のあるレビューを1つ生成してください。

## 📋 生成条件

**対象店舗**: SHOGUN BAR（池袋西口のエンタメバー）
**レビュアー設定**: ${pattern.age_group}・${pattern.personality_type}
**文字数**: 150-400字
**視点**: 一人称（実際に利用した体験として）

## ✅ 必須要素（自然に組み込む）
${requiredElements.map(elem => `• ${elem}`).join('\n')}

## 🎨 文体・語彙設定
**使用語彙**: ${pattern.vocabulary}
**感嘆符使用**: ${pattern.exclamation_marks}回程度
**文体特徴**: ${pattern.characteristics}

## ❌ 禁止表現（絶対に使用しない）
${prohibitedExpressions.map(expr => `• ${expr}`).join('\n')}

## 📝 参考例
${pattern.example}

## 🎯 生成指針
1. **自然性重視**: AIが書いたと分からない、人間らしい表現
2. **具体性**: 実際の体験を想像させる具体的な描写
3. **感情表現**: ${pattern.personality_type}らしい感情の込め方
4. **バランス**: 良い点・改善点を自然に織り交ぜる
5. **信頼性**: 過度な褒め言葉を避け、リアルな評価

レビューのみを出力してください（説明文は不要）。`;
}

/**
 * 品質スコア計算関数
 * @param {string} reviewText - 生成されたレビューテキスト
 * @param {Object} csvConfig - CSV設定データ
 * @param {Object} pattern - 使用されたヒューマンパターン
 * @returns {number} 品質スコア（0-10）
 */
function calculateQualityScore(reviewText, csvConfig, pattern) {
  let score = 10.0;
  const details = [];
  
  // 文字数チェック（150-400字）
  if (reviewText.length < 150) {
    score -= 2.0;
    details.push(`文字数不足: ${reviewText.length}字`);
  } else if (reviewText.length > 400) {
    score -= 1.5;
    details.push(`文字数過多: ${reviewText.length}字`);
  }
  
  // 禁止表現チェック
  const prohibitedExpressions = csvConfig.basicRules
    .filter(rule => rule.category === 'prohibited_expressions')
    .map(rule => rule.content);
    
  for (const expr of prohibitedExpressions) {
    if (reviewText.includes(expr)) {
      score -= 3.0;
      details.push(`禁止表現検出: ${expr}`);
    }
  }
  
  // 必須要素チェック
  const requiredElements = csvConfig.basicRules
    .filter(rule => rule.category === 'required_elements')
    .map(rule => rule.content);
    
  let requiredCount = 0;
  for (const elem of requiredElements) {
    if (reviewText.includes(elem)) {
      requiredCount++;
    }
  }
  
  if (requiredCount === 0) {
    score -= 4.0;
    details.push('必須要素なし');
  } else if (requiredCount < requiredElements.length / 2) {
    score -= 2.0;
    details.push(`必須要素不足: ${requiredCount}/${requiredElements.length}`);
  }
  
  // 感嘆符使用回数チェック
  const exclamationCount = (reviewText.match(/！/g) || []).length;
  const expectedExclamations = parseInt(pattern.exclamation_marks) || 0;
  
  if (Math.abs(exclamationCount - expectedExclamations) > 2) {
    score -= 1.0;
    details.push(`感嘆符数不一致: ${exclamationCount}個（期待: ${expectedExclamations}個）`);
  }
  
  // 自然性チェック（簡易版）
  if (reviewText.includes('AI') || reviewText.includes('人工知能')) {
    score -= 5.0;
    details.push('AI言及検出');
  }
  
  // 重複表現チェック
  const words = reviewText.split(/[。、！？\s]+/);
  const uniqueWords = new Set(words);
  if (words.length > 0 && uniqueWords.size / words.length < 0.7) {
    score -= 1.0;
    details.push('重複表現多数');
  }
  
  const finalScore = Math.max(0, Math.min(10, score));
  
  if (details.length > 0) {
    console.log(`品質スコア詳細 (${finalScore.toFixed(1)}): ${details.join(', ')}`);
  }
  
  return finalScore;
} 