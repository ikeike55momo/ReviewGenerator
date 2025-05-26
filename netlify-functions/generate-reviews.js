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
 * CSVデータを活用して自然なレビューを生成
 */
function generateTestReview(pattern, csvConfig, index) {
  // 必須要素を取得
  const requiredElements = csvConfig.basicRules
    ?.filter(rule => rule.category === 'required_elements')
    ?.map(rule => rule.content) || [];
  
  // 店舗名を必須要素から取得（デフォルト: SHOGUN BAR）
  const storeName = requiredElements.find(elem => elem.includes('BAR') || elem.includes('SHOGUN')) || 'SHOGUN BAR';
  const location = requiredElements.find(elem => elem.includes('池袋') || elem.includes('西口')) || '池袋西口';
  
  // 年代別の自然な表現
  const ageExpressions = {
    '10代': ['学生の私', '若い私', '10代の私'],
    '20代': ['20代の私', '若手社会人の私', '私'],
    '30代': ['30代の私', '私', 'アラサーの私'],
    '40代': ['40代の私', '私', 'アラフォーの私'],
    '50代': ['50代の私', '私', 'アラフィフの私'],
    '60代': ['60代の私', '私', 'シニアの私']
  };
  
  // 性格タイプ別の文体調整
  const personalityStyles = {
    'High型': {
      exclamations: ['！', '！！'],
      positiveWords: ['最高', '素晴らしい', '感動', 'めちゃくちゃ良い'],
      expressions: ['テンション上がりました', 'すごく楽しかった', '大満足']
    },
    'Medium型': {
      exclamations: ['。', '！'],
      positiveWords: ['良い', '満足', '楽しい', 'おすすめ'],
      expressions: ['楽しく過ごせました', '満足できました', 'また行きたい']
    },
    'Low型': {
      exclamations: ['。', '。'],
      positiveWords: ['良かった', '悪くない', 'まあまあ', '普通に良い'],
      expressions: ['落ち着いて過ごせました', 'のんびりできました', '居心地が良い']
    },
    'Formal型': {
      exclamations: ['。', '。'],
      positiveWords: ['品質が高い', '上質', '洗練された', '丁寧'],
      expressions: ['品のある空間でした', '質の高いサービス', '上品な雰囲気']
    },
    '超High型': {
      exclamations: ['！！', '！！！'],
      positiveWords: ['やばい', '最強', '神', 'ヤバすぎ'],
      expressions: ['テンション爆上がり', 'マジで最高', '神すぎる']
    }
  };
  
  const ageGroup = pattern.age_group || '30代';
  const personalityType = pattern.personality_type || 'Medium型';
  const ageExpr = ageExpressions[ageGroup] ? 
    ageExpressions[ageGroup][Math.floor(Math.random() * ageExpressions[ageGroup].length)] : '私';
  
  const style = personalityStyles[personalityType] || personalityStyles['Medium型'];
  const exclamation = style.exclamations[Math.floor(Math.random() * style.exclamations.length)];
  const positiveWord = style.positiveWords[Math.floor(Math.random() * style.positiveWords.length)];
  const expression = style.expressions[Math.floor(Math.random() * style.expressions.length)];
  
  // 自然なレビューテンプレート
  const templates = [
    `${location}にある${storeName}に行ってきました${exclamation}アクセスも良く、料理も${positiveWord}くて${expression}。スタッフの方も親切で、また利用したいと思います。`,
    
    `友人と${storeName}を利用しました${exclamation}${location}からすぐで便利ですね。料理のクオリティも高く、雰囲気も${positiveWord}感じでした。${expression}。`,
    
    `${storeName}での時間は${positiveWord}ものでした${exclamation}${location}エリアでは間違いなくおすすめのお店です。料理もドリンクも満足で、${expression}。`,
    
    `初めて${storeName}に行きましたが、想像以上に${positiveWord}お店でした${exclamation}${location}からのアクセスも良く、料理も期待を上回る美味しさ。${expression}。`,
    
    `${storeName}は${positiveWord}エンタメバーですね${exclamation}${location}という立地も魅力的で、料理とドリンクのバランスも良く、${expression}。また訪れたいです。`,
    
    `会社の同僚と${storeName}で食事をしました${exclamation}${location}からアクセスしやすく、料理も${positiveWord}くて会話も弾みました。${expression}。`,
    
    `${storeName}の雰囲気が${positiveWord}くて気に入りました${exclamation}${location}という便利な立地で、料理のレベルも高く、${expression}。リピート確定です。`,
    
    `デートで${storeName}を利用しました${exclamation}${location}からすぐで、料理も美味しく、雰囲気も${positiveWord}感じ。${expression}。カップルにもおすすめです。`
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