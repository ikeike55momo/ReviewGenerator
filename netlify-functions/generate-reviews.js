/**
 * @file generate-reviews.js
 * @description Netlify Functions用レビュー生成APIエンドポイント（Claude API連携版）
 * CSV駆動型AI創作システム - 置換禁止、ペルソナ完全体現による自然な口コミ生成
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
    console.log('=== CSV駆動AI創作システム 開始 ===');
    console.log('🔥 Netlify Function 呼び出し確認:', {
      httpMethod: event.httpMethod,
      path: event.path,
      headers: event.headers,
      bodyExists: !!event.body
    });
    
    // リクエストボディをパース
    const requestBody = JSON.parse(event.body || '{}');
    const { csvConfig, reviewCount, customPrompt } = requestBody;

    console.log('リクエスト受信:', { 
      csvConfigExists: !!csvConfig, 
      reviewCount,
      hasCustomPrompt: !!customPrompt,
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      basicRulesCount: csvConfig?.basicRules?.length || 0,
      qaKnowledgeCount: csvConfig?.qaKnowledge?.length || 0,
      successExamplesCount: csvConfig?.successExamples?.length || 0
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
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY環境変数が設定されていません');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'ANTHROPIC_API_KEY環境変数が設定されていません',
          details: 'Claude APIキーが必要です'
        }),
      };
    }

    console.log('環境変数チェック完了:', { 
      hasAnthropicKey: !!anthropicApiKey,
      keyLength: anthropicApiKey?.length || 0
    });

    // Claude API用のHTTPクライアント設定
    const https = require('https');
    const { URL } = require('url');

    // レビュー生成開始
    const generatedReviews = [];
    
    console.log(`${reviewCount}件のAI創作レビュー生成開始`);
    
    for (let i = 0; i < reviewCount; i++) {
      try {
        // ランダムにペルソナパターンを選択
        const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
        
        console.log(`レビュー ${i + 1} 生成中 - ペルソナ:`, {
          age_group: randomPattern.age_group,
          personality_type: randomPattern.personality_type,
          vocabulary: randomPattern.vocabulary?.substring(0, 30) + '...',
          exclamation_marks: randomPattern.exclamation_marks
        });
        
        // CSV駆動動的プロンプト生成
        const dynamicPrompt = buildDynamicPrompt(csvConfig, randomPattern, customPrompt);
        
        // Claude API呼び出し
        const reviewText = await callClaudeAPI(dynamicPrompt, anthropicApiKey);
        
        // 品質スコア計算
        const qualityScore = calculateQualityScore(reviewText, csvConfig, randomPattern);
        
        generatedReviews.push({
          text: reviewText,
          score: qualityScore,
          metadata: {
            age_group: randomPattern.age_group,
            personality_type: randomPattern.personality_type,
            vocabulary: randomPattern.vocabulary,
            exclamation_marks: randomPattern.exclamation_marks,
            generated_at: new Date().toISOString(),
            ai_generated: true,
            prompt_length: dynamicPrompt.length
          }
        });

        console.log(`レビュー ${i + 1}/${reviewCount} AI創作完了 (スコア: ${qualityScore}, 文字数: ${reviewText.length})`);
        
        // API制限対策：少し待機
        if (i < reviewCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`レビュー ${i + 1} AI創作エラー:`, error.message);
        
        // エラー時はスキップして次へ
        generatedReviews.push({
          text: `AI創作エラー: ${error.message}`,
          score: 0,
          metadata: {
            error: true,
            error_message: error.message,
            generated_at: new Date().toISOString()
          }
        });
        continue;
      }
    }

    // 品質フィルタリング（スコア6.0未満を除外）
    const filteredReviews = generatedReviews.filter(review => review.score >= 6.0);

    console.log(`AI創作完了 - 総数: ${generatedReviews.length}, フィルタ後: ${filteredReviews.length}`);
    console.log('=== CSV駆動AI創作システム 完了 ===');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(filteredReviews),
    };

  } catch (error) {
    console.error('CSV駆動AI創作システム Error:', error);
    console.error('Error Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'AI創作中に予期しないエラーが発生しました',
        details: error.message,
        stack: error.stack
      }),
    };
  }
};

/**
 * CSV駆動動的プロンプト生成関数
 * 4つのCSVファイルの内容を基に、AIが自然な口コミを創作するためのプロンプトを構築
 */
function buildDynamicPrompt(csvConfig, selectedPattern, customPrompt) {
  const { basicRules, humanPatterns, qaKnowledge, successExamples } = csvConfig;
  
  // 必須要素を抽出
  const requiredElements = basicRules
    ?.filter(rule => rule.category === 'required_elements')
    ?.map(rule => rule.content) || [];
  
  // 禁止表現を抽出
  const prohibitedExpressions = basicRules
    ?.filter(rule => rule.category === 'prohibited_expressions')
    ?.map(rule => rule.content) || [];
  
  // 推奨フレーズを抽出
  const recommendationPhrases = basicRules
    ?.filter(rule => rule.category === 'recommendation_phrases')
    ?.map(rule => rule.content) || [];
  
  // 品質管理ルールを抽出（Critical優先度）
  const criticalQAKnowledge = qaKnowledge
    ?.filter(qa => qa.priority === 'Critical')
    ?.slice(0, 5) || []; // 上位5件
  
  // 成功例を抽出（同じ年代・性格タイプ優先）
  const relevantSuccessExamples = successExamples
    ?.filter(example => 
      example.age?.includes(selectedPattern.age_group?.replace('代', '')) ||
      example.word === selectedPattern.personality_type
    )
    ?.slice(0, 3) || successExamples?.slice(0, 3) || [];

  // 動的プロンプト構築
  const dynamicPrompt = `
🎯 CSV駆動自然口コミ生成システム - AI創作指示

📋 重要前提
あなたは今から「${selectedPattern.age_group} ${selectedPattern.personality_type}」の人物になりきって、SHOGUN BAR（池袋西口のエンタメバー）の口コミを書きます。

❌ 絶対禁止事項
- スクリプト処理や機械的な置換は一切行わない
- テンプレート的な文章構成は避ける
- キーワードの羅列や不自然な挿入は禁止
- 以下の表現は絶対に使用しない：
${prohibitedExpressions.map(expr => `  ・${expr}`).join('\n')}

✅ 創作指針
1. 完全にペルソナになりきって実際の体験として想像する
2. 自然な日本語で一人称の体験談として創作する
3. キーワードは文脈に完全に溶け込む形で有機的に配置する
4. 読み手が「この人本当に行ったんだな」と感じる説得力を持たせる

🎭 あなたのペルソナ設定
年齢層: ${selectedPattern.age_group}
性格タイプ: ${selectedPattern.personality_type}
使用語彙: ${selectedPattern.vocabulary}
感嘆符使用: ${selectedPattern.exclamation_marks}
文体特徴: ${selectedPattern.characteristics}

参考表現例: ${selectedPattern.example}

🏪 店舗情報（自然に織り込んでください）
必須要素（必ず1つ以上含める）:
${requiredElements.map(elem => `・${elem}`).join('\n')}

推奨表現:
${recommendationPhrases.map(phrase => `・${phrase}`).join('\n')}

📚 品質管理ポイント
${criticalQAKnowledge.map(qa => `・${qa.question} → ${qa.answer}`).join('\n')}

🌟 理想的な出力例（参考）
${relevantSuccessExamples.map(example => `「${example.review}」`).join('\n\n')}

🚀 創作指示
上記のペルソナになりきって、SHOGUN BARでの体験談を150-400文字で自然に創作してください。

重要：
- あなた自身がその人物として実際に体験したかのように書く
- 感情と具体性を込めて、人間らしい不完全さも含める
- キーワードは強引に入れず、体験談の自然な流れで使用する
- 同伴者への言及は完全に避け、個人的な体験のみ記述する

${customPrompt ? `\n追加指示:\n${customPrompt}` : ''}
`;

  return dynamicPrompt;
}

/**
 * Claude API呼び出し関数
 * HTTPSリクエストでClaude APIを呼び出し、自然な口コミを生成
 */
async function callClaudeAPI(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.8,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.error('Claude API Error Response:', response);
            reject(new Error(`Claude API Error: ${response.error?.message || 'Unknown error'}`));
            return;
          }

          if (response.content && response.content[0] && response.content[0].text) {
            const generatedText = response.content[0].text.trim();
            console.log('Claude API Success:', { 
              textLength: generatedText.length,
              preview: generatedText.substring(0, 50) + '...'
            });
            resolve(generatedText);
          } else {
            console.error('Unexpected Claude API Response Structure:', response);
            reject(new Error('Claude APIからの応答形式が予期しないものでした'));
          }
        } catch (parseError) {
          console.error('Claude API Response Parse Error:', parseError);
          console.error('Raw Response:', data);
          reject(new Error(`Claude API応答のパースに失敗しました: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Claude API Request Error:', error);
      reject(new Error(`Claude APIリクエストエラー: ${error.message}`));
    });

    req.on('timeout', () => {
      console.error('Claude API Request Timeout');
      reject(new Error('Claude APIリクエストがタイムアウトしました'));
    });

    // タイムアウト設定（30秒）
    req.setTimeout(30000);

    req.write(postData);
    req.end();
  });
}

/**
 * 品質スコア計算関数
 * CSV設定に基づいてレビューの品質を評価
 */
function calculateQualityScore(reviewText, csvConfig, pattern) {
  let score = 10.0;
  const { basicRules, qaKnowledge } = csvConfig;

  // 文字数チェック（150-400文字が理想）
  const textLength = reviewText.length;
  if (textLength < 80) {
    score -= 3.0; // 短すぎる
  } else if (textLength < 150) {
    score -= 1.0; // やや短い
  } else if (textLength > 500) {
    score -= 2.0; // 長すぎる
  } else if (textLength > 400) {
    score -= 0.5; // やや長い
  }

  // 必須要素チェック
  const requiredElements = basicRules
    ?.filter(rule => rule.category === 'required_elements')
    ?.map(rule => rule.content) || [];

  let requiredElementsFound = 0;
  for (const element of requiredElements) {
    if (reviewText.includes(element)) {
      requiredElementsFound++;
    }
  }
  
  if (requiredElementsFound === 0) {
    score -= 3.0; // 必須要素が全くない
  } else if (requiredElementsFound < requiredElements.length * 0.3) {
    score -= 1.5; // 必須要素が少ない
  }

  // 禁止表現チェック
  const prohibitedExpressions = basicRules
    ?.filter(rule => rule.category === 'prohibited_expressions')
    ?.map(rule => rule.content) || [];

  for (const expression of prohibitedExpressions) {
    if (reviewText.includes(expression)) {
      score -= 2.0; // 禁止表現使用は重大な減点
    }
  }

  // 感嘆符使用チェック
  const exclamationCount = (reviewText.match(/！/g) || []).length;
  const expectedRange = pattern.exclamation_marks || '0-1個';
  
  if (expectedRange.includes('3-5') && (exclamationCount < 3 || exclamationCount > 5)) {
    score -= 0.5;
  } else if (expectedRange.includes('2-3') && (exclamationCount < 2 || exclamationCount > 3)) {
    score -= 0.5;
  } else if (expectedRange.includes('0-1') && exclamationCount > 1) {
    score -= 0.5;
  }

  // QA知識による品質チェック
  const criticalRules = qaKnowledge
    ?.filter(qa => qa.priority === 'Critical') || [];

  for (const rule of criticalRules) {
    if (rule.example_before && reviewText.includes(rule.example_before)) {
      score -= 1.5; // 改善前の表現が含まれている
    }
  }

  // 自然さチェック（簡易版）
  const unnaturalPatterns = [
    /(.)\1{3,}/, // 同じ文字の4回以上連続
    /[。！]{3,}/, // 句読点の3回以上連続
    /です。です。/, // 同じ語尾の連続
    /ます。ます。/, // 同じ語尾の連続
  ];

  for (const pattern of unnaturalPatterns) {
    if (pattern.test(reviewText)) {
      score -= 0.5;
    }
  }

  return Math.max(0, Math.min(10, score));
} 