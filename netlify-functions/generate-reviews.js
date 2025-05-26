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
        
        // 品質スコア計算（簡易版）
        const qualityScore = calculateQualityScore(reviewText, csvConfig);
        
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
        
        // エラー時はダミーレビューを生成
        generatedReviews.push({
          text: `レビュー生成エラーが発生しました: ${error.message}`,
          score: 0,
          metadata: {
            age_group: '30代',
            personality_type: 'default',
            generated_at: new Date().toISOString(),
            error: true
          }
        });
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

以下の条件で、自然な日本語レビューを1つ生成してください：

対象店舗: SHOGUN BAR（池袋西口のエンタメバー）
年齢層: ${pattern.age_group}
性格タイプ: ${pattern.personality_type}

必須要素:
${requiredElements.map(elem => `- ${elem}`).join('\n')}

使用可能な語彙:
${pattern.vocabulary}

感嘆符使用回数: ${pattern.exclamation_marks}

文体の特徴:
${pattern.characteristics}

禁止表現:
${prohibitedExpressions.map(expr => `- ${expr}`).join('\n')}

参考例:
${pattern.example}

重要：自然で人間らしい文章として、150-400字程度で生成してください。キーワードは自然に配置し、一人称視点で書いてください。`;
}

/**
 * 品質スコア計算関数（簡易版）
 */
function calculateQualityScore(reviewText, csvConfig) {
  let score = 10.0;
  
  // 文字数チェック
  if (reviewText.length < 150 || reviewText.length > 400) {
    score -= 2.0;
  }
  
  // 禁止表現チェック
  const prohibitedExpressions = csvConfig.basicRules
    .filter(rule => rule.category === 'prohibited_expressions')
    .map(rule => rule.content);
    
  for (const expr of prohibitedExpressions) {
    if (reviewText.includes(expr)) {
      score -= 3.0;
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
  }
  
  return Math.max(0, Math.min(10, score));
} 