/**
 * @file generate-reviews.js
 * @description Netlify Functions用レビュー生成APIエンドポイント
 * 純粋JavaScript実装でTypeScript依存関係を回避
 */

// デバッグ用：依存関係を最小限に

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

    // デバッグ用：ダミーレビュー生成
    const generatedReviews = [];
    
    for (let i = 0; i < Math.min(reviewCount, 5); i++) {
      try {
        // ランダムにパターンを選択
        const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
        
        // ダミーレビューテキスト生成
        const reviewText = generateDummyReview(randomPattern, i + 1);
        
        // 品質スコア計算（簡易版）
        const qualityScore = calculateQualityScore(reviewText, csvConfig);
        
        generatedReviews.push({
          text: reviewText,
          score: qualityScore,
          metadata: {
            age_group: randomPattern.age_group,
            personality_type: randomPattern.personality_type,
            generated_at: new Date().toISOString(),
            debug: true
          }
        });

        console.log(`ダミーレビュー ${i + 1}/${reviewCount} 生成完了 (スコア: ${qualityScore})`);
      } catch (error) {
        console.error(`レビュー ${i + 1} 生成エラー:`, error);
        
        // エラー時はエラーレビューを生成
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
 * ダミーレビュー生成関数（デバッグ用）
 */
function generateDummyReview(pattern, index) {
  const templates = [
    `SHOGUN BARに行ってきました！${pattern.age_group}の私にはとても楽しい時間でした。池袋西口からすぐの立地で、アクセスも良好です。店内の雰囲気も素晴らしく、スタッフの方々も親切でした。また利用したいと思います。`,
    `池袋西口のSHOGUN BARを利用しました。${pattern.personality_type}な性格の私でも楽しめる空間でした。料理も美味しく、ドリンクの種類も豊富で満足できました。友人にもおすすめしたいお店です。`,
    `SHOGUN BARでの体験は最高でした！${pattern.age_group}世代にはぴったりのエンタメバーだと思います。音楽も良く、料理のクオリティも高いです。池袋西口エリアでは間違いなくおすすめのお店です。`,
    `池袋西口のSHOGUN BARに初めて行きました。${pattern.personality_type}な私でも居心地よく過ごせました。スタッフの接客も丁寧で、料理も期待以上でした。また訪れたいと思います。`,
    `SHOGUN BARは素晴らしいエンタメバーです！${pattern.age_group}の私には理想的な空間でした。池袋西口からのアクセスも便利で、料理とドリンクのバランスも良く、大満足の時間を過ごせました。`
  ];
  
  return templates[index % templates.length];
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