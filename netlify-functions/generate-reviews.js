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
 * 高品質レビュー生成関数
 * success_examples.csvの品質レベルを目指した自然なレビュー生成
 */
function generateTestReview(pattern, csvConfig, index) {
  // 必須要素を取得
  const requiredElements = csvConfig.basicRules
    ?.filter(rule => rule.category === 'required_elements')
    ?.map(rule => rule.content) || [];
  
  // 店舗名を必須要素から取得（デフォルト: SHOGUN BAR）
  const storeName = requiredElements.find(elem => elem.includes('BAR') || elem.includes('SHOGUN')) || 'SHOGUN BAR';
  const location = requiredElements.find(elem => elem.includes('池袋') || elem.includes('西口')) || '池袋西口';
  
  // 性格タイプ別のリアルな表現パターン
  const personalityPatterns = {
    'High型': {
      problemExpressions: ['めちゃくちゃ混んでて入れるか心配だった', '期待してなかったけど', '正直不安だった'],
      solutionWords: ['ビビりました', '感動しました', '最高でした', 'すごく良かった'],
      exclamations: ['！', '！！'],
      intensifiers: ['めちゃくちゃ', 'すごく', 'マジで'],
      recommendations: ['推せます', 'おすすめです', '絶対行くべき']
    },
    '超High型': {
      problemExpressions: ['ガチで期待してなかった', 'マジで不安だった', '正直ダメかと思った'],
      solutionWords: ['神でした', 'ヤバすぎ', '最強', 'やばい'],
      exclamations: ['！！', '！！！'],
      intensifiers: ['ガチで', 'マジで', 'めっちゃ', '超'],
      recommendations: ['神すぎる', 'マジでおすすめ', '絶対行って']
    },
    'Medium型': {
      problemExpressions: ['少し心配でしたが', '期待半分不安半分でしたが', '初めてで緊張しましたが'],
      solutionWords: ['満足できました', '良かったです', '感動しました', '安心しました'],
      exclamations: ['。', '！'],
      intensifiers: ['とても', 'かなり', 'すごく'],
      recommendations: ['おすすめします', 'おすすめです', '良いと思います']
    },
    'Low型': {
      problemExpressions: ['少し不安でしたが', '心配でしたが', '緊張しましたが'],
      solutionWords: ['安心しました', '良かったです', '満足です', '落ち着けました'],
      exclamations: ['。', '。'],
      intensifiers: ['とても', '結構', 'なかなか'],
      recommendations: ['おすすめです', '良いと思います', '安心できます']
    },
    'Formal型': {
      problemExpressions: ['多少の不安がありましたが', '初回で緊張いたしましたが', '期待と不安がありましたが'],
      solutionWords: ['満足いたしました', '感銘を受けました', '素晴らしかったです', '上質でした'],
      exclamations: ['。', '。'],
      intensifiers: ['非常に', '大変', 'とても'],
      recommendations: ['おすすめいたします', 'お勧めできます', '推奨いたします']
    }
  };
  
  // 店舗固有の特徴（SHOGUN BAR想定）
  const storeFeatures = [
    '個室風の空間で落ち着いて過ごせる',
    'ドリンクサービスがあって居心地が良い',
    '清潔感のある店内',
    'スタッフの方が親切で丁寧',
    'リクライニングチェアでリラックスできる',
    '衛生管理がしっかりしている',
    'メイクルームもあって便利'
  ];
  
  // 体験シナリオパターン
  const experienceScenarios = [
    {
      problem: '仕事のストレスで疲れていて',
      solution: 'リラックスできて気分転換になった',
      result: 'また疲れた時に利用したい'
    },
    {
      problem: '初めての利用で緊張していたけど',
      solution: 'スタッフの方が優しくて安心できた',
      result: '次回も安心して利用できそう'
    },
    {
      problem: '時間がなくて急いでいたけど',
      solution: 'スムーズに対応してもらえた',
      result: '忙しい時でも利用しやすい'
    },
    {
      problem: '他の店で嫌な思いをしたことがあって不安だったけど',
      solution: 'ここは全然違って素晴らしかった',
      result: 'もうここ以外は考えられない'
    },
    {
      problem: '料金が心配だったけど',
      solution: 'サービス内容を考えると納得の価格',
      result: 'コスパが良いと思う'
    }
  ];
  
  const personalityType = pattern.personality_type || 'Medium型';
  const style = personalityPatterns[personalityType] || personalityPatterns['Medium型'];
  
  // ランダム要素選択
  const problemExpr = style.problemExpressions[Math.floor(Math.random() * style.problemExpressions.length)];
  const solutionWord = style.solutionWords[Math.floor(Math.random() * style.solutionWords.length)];
  const exclamation = style.exclamations[Math.floor(Math.random() * style.exclamations.length)];
  const intensifier = style.intensifiers[Math.floor(Math.random() * style.intensifiers.length)];
  const recommendation = style.recommendations[Math.floor(Math.random() * style.recommendations.length)];
  const feature = storeFeatures[Math.floor(Math.random() * storeFeatures.length)];
  const scenario = experienceScenarios[Math.floor(Math.random() * experienceScenarios.length)];
  
  // success_examples.csv品質のレビューテンプレート
  const templates = [
    `${location}の${storeName}に行ってきました${exclamation}${scenario.problem}、${intensifier}${solutionWord}${exclamation}${feature}のも良かったです。${scenario.result}し、同じような方に${recommendation}${exclamation}`,
    
    `${storeName}で${scenario.problem}、${problemExpr}実際に利用してみたら${intensifier}${solutionWord}${exclamation}${feature}し、${scenario.result}と思います。${recommendation}${exclamation}`,
    
    `${location}にある${storeName}を利用しました${exclamation}${scenario.problem}、スタッフの方が${intensifier}親切で${solutionWord}${exclamation}${feature}のも魅力的です。${recommendation}${exclamation}`,
    
    `${storeName}に初めて行きました${exclamation}${problemExpr}、${intensifier}${solutionWord}${exclamation}${feature}し、${scenario.result}です。同じ悩みの方に${recommendation}${exclamation}`,
    
    `${location}の${storeName}での体験は${solutionWord}${exclamation}${scenario.problem}、期待以上の結果で${intensifier}満足です${exclamation}${feature}のも嬉しいポイントでした。`,
    
    `${storeName}を利用して${intensifier}${solutionWord}${exclamation}${scenario.problem}、ここなら安心だと思いました。${feature}し、${scenario.result}です。${recommendation}${exclamation}`,
    
    `${location}エリアで${storeName}を見つけて利用しました${exclamation}${problemExpr}、実際は${intensifier}${solutionWord}${exclamation}${feature}のが特に印象的でした。`,
    
    `${storeName}での時間は${intensifier}${solutionWord}${exclamation}${scenario.problem}、ここで解決できて本当に良かったです。${feature}のも安心できるポイントです。${recommendation}${exclamation}`
  ];
  
  return templates[index % templates.length];
}

/**
 * 品質スコア計算関数
 */
function calculateQualityScore(reviewText, csvConfig, pattern) {
  let score = 10.0;
  const details = [];
  
  // 文字数チェック（80-400字に調整）
  if (reviewText.length < 80) {
    score -= 3.0;
    details.push(`文字数不足: ${reviewText.length}字`);
  } else if (reviewText.length < 120) {
    score -= 1.0;
    details.push(`文字数やや不足: ${reviewText.length}字`);
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