/**
 * @file generate-reviews.js
 * @description Netlify Functions用レビュー生成APIエンドポイント（テスト版）
 * Claude API依存関係なしで動作確認
 */

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
    console.log('=== Netlify Function 開始 ===');
    
    // リクエストボディをパース
    const requestBody = JSON.parse(event.body || '{}');
    const { csvConfig, reviewCount } = requestBody;

    console.log('リクエスト受信:', { 
      csvConfigExists: !!csvConfig, 
      reviewCount,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0
    });

    // 入力バリデーション
    if (!csvConfig || !reviewCount) {
      console.error('バリデーションエラー:', { csvConfig: !!csvConfig, reviewCount: !!reviewCount });
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
      console.error('reviewCount範囲エラー:', reviewCount);
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
    console.log('環境変数チェック:', { 
      hasAnthropicKey: !!anthropicApiKey,
      keyLength: anthropicApiKey?.length || 0
    });

    // テスト用レビュー生成（Claude API使用せず）
    const generatedReviews = [];
    
    console.log(`${reviewCount}件のテストレビュー生成開始`);
    
    for (let i = 0; i < Math.min(reviewCount, 10); i++) {
      try {
        // ランダムにパターンを選択
        const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
        
        console.log(`レビュー ${i + 1} 生成中 - パターン:`, {
          age_group: randomPattern.age_group,
          personality_type: randomPattern.personality_type
        });
        
        // テスト用レビューテキスト生成
        const reviewText = generateTestReview(randomPattern, csvConfig, i + 1);
        
        // 品質スコア計算
        const qualityScore = calculateQualityScore(reviewText, csvConfig, randomPattern);
        
        generatedReviews.push({
          text: reviewText,
          score: qualityScore,
          metadata: {
            age_group: randomPattern.age_group,
            personality_type: randomPattern.personality_type,
            generated_at: new Date().toISOString(),
            test_mode: true
          }
        });

        console.log(`レビュー ${i + 1}/${reviewCount} 生成完了 (スコア: ${qualityScore})`);
      } catch (error) {
        console.error(`レビュー ${i + 1} 生成エラー:`, error);
        continue;
      }
    }

    // 品質フィルタリング（スコア6.0未満を除外）
    const filteredReviews = generatedReviews.filter(review => review.score >= 6.0);

    console.log(`生成完了 - 総数: ${generatedReviews.length}, フィルタ後: ${filteredReviews.length}`);
    console.log('=== Netlify Function 完了 ===');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(filteredReviews),
    };

  } catch (error) {
    console.error('Netlify Function Error:', error);
    console.error('Error Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'レビュー生成中に予期しないエラーが発生しました',
        details: error.message,
        stack: error.stack
      }),
    };
  }
};

/**
 * テスト用レビュー生成関数
 */
function generateTestReview(pattern, csvConfig, index) {
  const templates = [
    `SHOGUN BARに${pattern.age_group}の私が行ってきました！池袋西口からアクセスも良く、${pattern.personality_type}な私でも楽しめる雰囲気でした。料理も美味しく、スタッフの方も親切で、また利用したいと思います。`,
    `池袋西口のSHOGUN BARを利用しました。${pattern.age_group}世代にはぴったりのエンタメバーだと思います。${pattern.personality_type}な性格の私でも居心地よく過ごせました。料理のクオリティも高く満足です。`,
    `SHOGUN BARでの体験は最高でした！${pattern.age_group}の私には理想的な空間で、池袋西口エリアでは間違いなくおすすめのお店です。${pattern.personality_type}な私でも楽しめる素晴らしいエンタメバーでした。`,
    `池袋西口のSHOGUN BARに初めて行きました。${pattern.personality_type}な私でも安心して楽しめる雰囲気で、${pattern.age_group}世代には特におすすめです。料理も期待以上で、また訪れたいと思います。`,
    `SHOGUN BARは素晴らしいエンタメバーです！${pattern.age_group}の私には最適な空間でした。池袋西口からのアクセスも便利で、${pattern.personality_type}な性格でも十分楽しめました。`
  ];
  
  return templates[index % templates.length];
}

/**
 * 品質スコア計算関数
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
    ?.filter(rule => rule.category === 'prohibited_expressions')
    ?.map(rule => rule.content) || [];
    
  for (const expr of prohibitedExpressions) {
    if (reviewText.includes(expr)) {
      score -= 3.0;
      details.push(`禁止表現検出: ${expr}`);
    }
  }
  
  // 必須要素チェック
  const requiredElements = csvConfig.basicRules
    ?.filter(rule => rule.category === 'required_elements')
    ?.map(rule => rule.content) || [];
    
  let requiredCount = 0;
  for (const elem of requiredElements) {
    if (reviewText.includes(elem)) {
      requiredCount++;
    }
  }
  
  if (requiredElements.length > 0 && requiredCount === 0) {
    score -= 4.0;
    details.push('必須要素なし');
  } else if (requiredElements.length > 0 && requiredCount < requiredElements.length / 2) {
    score -= 2.0;
    details.push(`必須要素不足: ${requiredCount}/${requiredElements.length}`);
  }
  
  const finalScore = Math.max(0, Math.min(10, score));
  
  if (details.length > 0) {
    console.log(`品質スコア詳細 (${finalScore.toFixed(1)}): ${details.join(', ')}`);
  }
  
  return finalScore;
} 