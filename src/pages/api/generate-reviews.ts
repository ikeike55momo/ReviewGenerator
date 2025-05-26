/**
 * @file generate-reviews.ts
 * @description レビュー生成APIエンドポイント（Claude API + データベース連携版）
 * CSV駆動型AI創作システム - バッチ管理・履歴保存対応
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';
import { 
  createGenerationBatch, 
  updateBatchStatus, 
  saveGeneratedReview,
  logQualityCheck 
} from '../../utils/database';
import https from 'https';

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  batchName?: string;
  saveToDB?: boolean;
}

interface BatchGenerateRequest {
  csvConfig: CSVConfig;
  batchSize: number;
  batchCount: number;
  customPrompt?: string;
  batchName?: string;
}

/**
 * CSV駆動動的プロンプト生成関数
 * 4つのCSVファイルの内容を基に、AIが自然な口コミを創作するためのプロンプトを構築
 */
function buildDynamicPrompt(csvConfig: CSVConfig, selectedPattern: any, customPrompt?: string): {
  dynamicPrompt: string;
  selectedBusinessType: string;
  selectedRecommendation: string;
  targetLength: number;
  selectedArea: string;
  selectedUSPs: string[];
  selectedEnvironment: string;
  selectedSubs: string[];
} {
  const { basicRules, humanPatterns, qaKnowledge, successExamples } = csvConfig;
  
  // 文字数をランダムに設定（150-400文字、短文重視の重み付け）
  const random = Math.random();
  let targetLength;
  
  if (random < 0.4) {
    // 40%の確率で150-200文字（短文）
    targetLength = Math.floor(Math.random() * (200 - 150 + 1)) + 150;
  } else if (random < 0.7) {
    // 30%の確率で201-250文字（中短文）
    targetLength = Math.floor(Math.random() * (250 - 201 + 1)) + 201;
  } else if (random < 0.9) {
    // 20%の確率で251-300文字（中文）
    targetLength = Math.floor(Math.random() * (300 - 251 + 1)) + 251;
  } else {
    // 10%の確率で301-400文字（長文）
    targetLength = Math.floor(Math.random() * (400 - 301 + 1)) + 301;
  }
  
  const lengthGuidance = targetLength <= 200 ? '簡潔に' : 
                        targetLength <= 250 ? 'コンパクトに' : 
                        targetLength <= 300 ? '適度な詳しさで' : '詳細に';
  
  // 必須要素をカテゴリ別に抽出
  const requiredAreas = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')
    ?.map(rule => rule.content) || [];
  const selectedArea = requiredAreas[Math.floor(Math.random() * requiredAreas.length)] || '池袋西口';
  
  const businessTypes = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')
    ?.map(rule => rule.content) || [];
  const selectedBusinessType = businessTypes[Math.floor(Math.random() * businessTypes.length)] || 'SHOGUN BAR';
  
  const uspElements = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')
    ?.map(rule => rule.content) || [];
  // USPから文字数に応じて1-3個を選択
  const uspCount = targetLength <= 200 ? 1 : targetLength <= 300 ? 2 : 3;
  const selectedUSPs = uspElements.sort(() => 0.5 - Math.random()).slice(0, Math.min(uspCount, uspElements.length));
  
  const environmentElements = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')
    ?.map(rule => rule.content) || [];
  // 環境要素から1個をランダム選択（必須）
  const selectedEnvironment = environmentElements[Math.floor(Math.random() * environmentElements.length)];
  
  // サブ要素（自由使用）
  const subElements = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'sub')
    ?.map(rule => rule.content) || [];
  // サブ要素から0-2個をランダム選択（自然さ重視）
  const selectedSubs = subElements.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3));
  
  // 禁止表現を抽出
  const prohibitedExpressions = basicRules
    ?.filter(rule => rule.category === 'prohibited_expressions')
    ?.map(rule => rule.content) || [];
  
  // 推奨フレーズを抽出（レコメンド用）
  const recommendationPhrases = basicRules
    ?.filter(rule => rule.category === 'recommendation_phrases')
    ?.map(rule => rule.content) || [];
  const selectedRecommendation = recommendationPhrases[Math.floor(Math.random() * recommendationPhrases.length)] || '日本酒好きに';
  
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
あなたは今から「${selectedPattern.age_group} ${selectedPattern.personality_type}」の人物になりきって、${selectedBusinessType}（池袋西口）の口コミを書きます。

❌ 絶対禁止事項
- スクリプト処理や機械的な置換は一切行わない
- テンプレート的な文章構成は避ける
- キーワードの羅列や不自然な挿入は禁止
- 絵文字は一切使用しない（😊🎉✨等の絵文字は完全禁止）
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

🏪 店舗情報（厳密に従ってください）
【必須要素 - 必ず全て含める】
・エリア: ${selectedArea} （必ず1つ）
・業種: ${selectedBusinessType} （必ず1つ）
・USP: ${selectedUSPs.join('、')} （必ず${selectedUSPs.length}つ全て）
・環境: ${selectedEnvironment} （必ず1つ）
・推奨用途: ${selectedRecommendation} （文末に必ず配置）

【推奨使用要素 - 積極的に活用】
・サブ要素: ${selectedSubs.join('、')} （${selectedSubs.length > 0 ? '体験談の深みを増すため積極的に使用' : '該当なし'}）

🎯 ワード使用の厳密ルール:
1. エリア「${selectedArea}」を必ず文中に含める
2. 業種「${selectedBusinessType}」を必ず文中に含める  
3. USP「${selectedUSPs.join('」「')}」を全て体験談として自然に織り込む
4. 環境「${selectedEnvironment}」を印象・感想として表現する
5. 推奨用途「${selectedRecommendation}」を文末に必ず配置する
6. サブ要素「${selectedSubs.join('」「')}」を${selectedSubs.length > 0 ? '体験談に自然に織り込む（推奨）' : '使用しない'}

📚 品質管理ポイント
${criticalQAKnowledge.map(qa => `・${qa.question} → ${qa.answer}`).join('\n')}

🌟 理想的な出力例（参考）
${relevantSuccessExamples.map(example => `「${example.review}」`).join('\n\n')}

🚀 創作指示
上記のペルソナになりきって、${selectedBusinessType}での体験談を${lengthGuidance}${targetLength}文字程度で自然に創作してください。

重要：
- あなた自身がその人物として実際に体験したかのように書く
- 感情と具体性を込めて、人間らしい不完全さも含める
- キーワードは強引に入れず、体験談の自然な流れで使用する
- 同伴者への言及は完全に避け、個人的な体験のみ記述する
- 文字数は${targetLength}文字程度を目安にする（短めを心がける）
- 絵文字は絶対に使用しない（感嘆符や句読点のみ使用）
- サブ要素${selectedSubs.length > 0 ? `「${selectedSubs.join('」「')}」を体験談に自然に含める` : 'は使用しない'}

❌ 絶対禁止：
- 「Note:」「注意:」「備考:」「特徴:」「解説:」などの説明文は一切付けない
- 解説や分析は一切含めない
- メタ情報や特徴説明は絶対に含めない
- 上記で指定されていないキーワードの勝手な追加は禁止
- 指定されたワード以外の店舗特徴や商品名の創作は禁止
- 「源義経」「織田信長」等の具体的な武将名は使用禁止
- 「スコッチ」「バーボン」等の関係ない酒類は使用禁止

🎯 出力形式：純粋なレビューテキストのみ
- 説明文、注釈、解説は一切含めない
- レビュー本文以外は絶対に出力しない
- 改行後の追加情報も一切禁止

${customPrompt ? `\n追加指示:\n${customPrompt}` : ''}
`;

  return { 
    dynamicPrompt, 
    selectedBusinessType, 
    selectedRecommendation, 
    targetLength,
    selectedArea,
    selectedUSPs,
    selectedEnvironment,
    selectedSubs
  };
}

/**
 * Claude API呼び出し関数
 * HTTPSリクエストでClaude APIを呼び出し、自然な口コミを生成
 */
async function callClaudeAPI(prompt: string, apiKey: string): Promise<string> {
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
            let generatedText = response.content[0].text.trim();
            
            // 余計なNote説明文を除去
            generatedText = generatedText.replace(/\n\nNote:[\s\S]*$/, ''); // Note以降を削除
            generatedText = generatedText.replace(/\n注意:[\s\S]*$/, ''); // 注意以降を削除
            generatedText = generatedText.replace(/\n備考:[\s\S]*$/, ''); // 備考以降を削除
            generatedText = generatedText.replace(/\n\n.*特徴[\s\S]*$/, ''); // 特徴説明を削除
            generatedText = generatedText.trim();
            
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
          reject(new Error(`Claude API応答のパースに失敗しました: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`));
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
 * 文字列類似度計算関数（簡易版・緩い判定）
 * 共通する文字列の割合で類似度を計算
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  
  // 文字数が大きく異なる場合は類似度低
  const len1 = str1.length;
  const len2 = str2.length;
  const lengthDiff = Math.abs(len1 - len2) / Math.max(len1, len2);
  if (lengthDiff > 0.5) return 0;
  
  // 共通する部分文字列をチェック（緩い判定）
  const words1 = str1.split(/[。！？、]/);
  const words2 = str2.split(/[。！？、]/);
  
  let commonCount = 0;
  for (const word1 of words1) {
    if (word1.length > 10) { // 10文字以上の文で判定
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          commonCount++;
          break;
        }
      }
    }
  }
  
  const maxWords = Math.max(words1.length, words2.length);
  return maxWords > 0 ? commonCount / maxWords : 0;
}

/**
 * 品質スコア計算関数
 * CSV設定に基づいてレビューの品質を評価
 */
function calculateQualityScore(
  reviewText: string, 
  csvConfig: CSVConfig, 
  pattern: any, 
  selectedElements: {
    area: string;
    businessType: string;
    usps: string[];
    environment: string;
    subs: string[];
  }
): number {
  let score = 10.0;
  const { basicRules, qaKnowledge } = csvConfig;

  // 文字数チェック（150-400文字が理想、短文重視）
  const textLength = reviewText.length;
  if (textLength < 100) {
    score -= 3.0; // 短すぎる
  } else if (textLength < 150) {
    score -= 1.0; // やや短い
  } else if (textLength > 450) {
    score -= 2.0; // 長すぎる
  } else if (textLength > 400) {
    score -= 0.5; // やや長い
  } else if (textLength > 300) {
    score -= 0.2; // 長めだが許容範囲
  }

  // 必須要素の厳密チェック（basic_rules.csvルール準拠）
  
  // エリア必須チェック（必ず1つ）
  if (!reviewText.includes(selectedElements.area)) {
    score -= 3.0; // エリア言及なしは重大減点
  }
  
  // 業種必須チェック（必ず1つ）
  if (!reviewText.includes(selectedElements.businessType)) {
    score -= 3.0; // 業種言及なしは重大減点
  }
  
  // USP厳密チェック（選択された全てのUSPが必要）
  let uspFoundCount = 0;
  for (const usp of selectedElements.usps) {
    if (reviewText.includes(usp)) {
      uspFoundCount++;
    }
  }
  const uspMissingCount = selectedElements.usps.length - uspFoundCount;
  score -= uspMissingCount * 1.5; // 不足USP1つにつき1.5点減点
  
  // 環境要素必須チェック（必ず1つ）
  if (!selectedElements.environment || !reviewText.includes(selectedElements.environment)) {
    score -= 2.0; // 環境言及なしは重大減点
  }
  
  // レコメンド文末チェック（文末に必ず配置）
  const recommendationPhrases = basicRules
    ?.filter(rule => rule.category === 'recommendation_phrases')
    ?.map(rule => rule.content) || [];
  
  let recommendationFound = false;
  for (const phrase of recommendationPhrases) {
    if (reviewText.includes(phrase)) {
      recommendationFound = true;
      // 文末近くにあるかチェック（最後の50文字以内）
      const lastPart = reviewText.slice(-50);
      if (!lastPart.includes(phrase)) {
        score -= 0.5; // 文末にない場合は軽度減点
      }
      break;
    }
  }
  if (!recommendationFound) {
    score -= 2.0; // レコメンドなしは重大減点
  }

  // サブ要素チェック（推奨使用）
  if (selectedElements.subs && selectedElements.subs.length > 0) {
    let subFoundCount = 0;
    for (const sub of selectedElements.subs) {
      if (reviewText.includes(sub)) {
        subFoundCount++;
      }
    }
    // サブ要素の使用率に応じてボーナス/減点
    const subUsageRate = subFoundCount / selectedElements.subs.length;
    if (subUsageRate >= 0.5) {
      score += 0.5; // 半分以上使用でボーナス
    } else if (subUsageRate === 0) {
      score -= 0.3; // 全く使用しない場合は軽度減点
    }
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

  // 絵文字使用チェック（絵文字は完全禁止）
  const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]+|[\u2600-\u27BF]/g;
  if (emojiPattern.test(reviewText)) {
    score -= 3.0; // 絵文字使用は重大な減点
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🔥 API /generate-reviews 呼び出し開始:', {
    method: req.method,
    headers: req.headers,
    bodyExists: !!req.body
  });

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONSリクエスト処理完了');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('❌ 許可されていないメソッド:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 リクエストボディ解析開始:', { bodyType: typeof req.body });
    
    const { csvConfig, reviewCount, customPrompt, batchName, saveToDB }: GenerateReviewsRequest = req.body;

    console.log('📊 パラメータ確認:', {
      hasCsvConfig: !!csvConfig,
      reviewCount,
      hasCustomPrompt: !!customPrompt,
      csvConfigKeys: csvConfig ? Object.keys(csvConfig) : [],
      humanPatternsCount: csvConfig?.humanPatterns?.length || 0,
      basicRulesCount: csvConfig?.basicRules?.length || 0
    });

    // 入力バリデーション
    if (!csvConfig || !reviewCount) {
      console.error('❌ バリデーションエラー:', { csvConfig: !!csvConfig, reviewCount: !!reviewCount });
      return res.status(400).json({ 
        error: 'csvConfigとreviewCountは必須です',
        details: { csvConfig: !!csvConfig, reviewCount: !!reviewCount }
      });
    }

    if (reviewCount < 1 || reviewCount > 100) {
      console.error('❌ reviewCount範囲エラー:', reviewCount);
      return res.status(400).json({ 
        error: 'reviewCountは1～100の範囲で指定してください',
        details: { reviewCount }
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('❌ ANTHROPIC_API_KEY環境変数が設定されていません');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません',
        details: 'Claude APIキーが必要です'
      });
    }

    console.log('✅ 環境変数チェック完了:', { 
      hasAnthropicKey: !!anthropicApiKey,
      keyLength: anthropicApiKey?.length || 0
    });

    // レビュー生成開始
    const generatedReviews: GeneratedReview[] = [];
    const generatedTexts: string[] = []; // 重複チェック用（配列で管理）
    
    // データベースから既存のレビューを取得してグローバル重複チェック
    let existingReviews: string[] = [];
    if (saveToDB) {
      try {
        const { getExistingReviews } = await import('../../utils/database');
        existingReviews = await getExistingReviews();
        console.log(`📚 既存レビュー取得: ${existingReviews.length}件`);
      } catch (error) {
        console.warn('⚠️ 既存レビュー取得エラー:', error);
      }
    }
    
    console.log(`🚀 ${reviewCount}件のAI創作レビュー生成開始`);
    
    for (let i = 0; i < reviewCount; i++) {
      let reviewText = '';
      let attempts = 0;
      const maxAttempts = 5; // 最大再試行回数
      let finalPromptResult: any = null;
      let finalRandomPattern: any = null;
      
      try {
        // 重複しないレビューが生成されるまでループ
        while (attempts < maxAttempts) {
          attempts++;
          
          // ランダムにペルソナパターンを選択
          const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
          
          console.log(`📝 レビュー ${i + 1} 生成中 (試行${attempts}/${maxAttempts}) - ペルソナ:`, {
            age_group: randomPattern.age_group,
            personality_type: randomPattern.personality_type,
            vocabulary: randomPattern.vocabulary?.substring(0, 30) + '...',
            exclamation_marks: randomPattern.exclamation_marks
          });
          
          // CSV駆動動的プロンプト生成（ランダム性を高めるため毎回生成）
          const promptResult = buildDynamicPrompt(csvConfig, randomPattern, customPrompt);
          
          console.log(`🎯 選択された要素:`, {
            area: promptResult.selectedArea,
            businessType: promptResult.selectedBusinessType,
            usps: promptResult.selectedUSPs,
            environment: promptResult.selectedEnvironment,
            subs: promptResult.selectedSubs,
            recommendation: promptResult.selectedRecommendation
          });
          const { dynamicPrompt } = promptResult;
          
          // ユニーク性を高めるためのプロンプト追加
          const uniquePrompt = dynamicPrompt + `\n\n🔄 重要：これまでに生成されたレビューとは完全に異なる、ユニークな体験談を創作してください。同じ表現や似た構成は避け、新鮮で独創的な内容にしてください。試行回数: ${attempts}`;
          
          // Claude API呼び出し
          reviewText = await callClaudeAPI(uniquePrompt, anthropicApiKey);
          
                      // グローバル重複チェック（既存レビュー + 今回生成分）
            const allExistingTexts = [...existingReviews, ...generatedTexts];
            
            // 完全一致チェック
            if (!allExistingTexts.includes(reviewText)) {
              // 類似度チェック（緩い判定）
              let isSimilar = false;
              let maxSimilarity = 0;
              
              for (const existingText of allExistingTexts) {
                const similarity = calculateSimilarity(reviewText, existingText);
                if (similarity > maxSimilarity) {
                  maxSimilarity = similarity;
                }
                if (similarity > 0.6) { // 閾値を0.6に緩和
                  isSimilar = true;
                  console.log(`⚠️ 類似レビュー検出 (類似度: ${(similarity * 100).toFixed(1)}%) - 再生成します`);
                  break;
                }
              }
              
              if (!isSimilar) {
                generatedTexts.push(reviewText);
                finalPromptResult = promptResult;
                finalRandomPattern = randomPattern;
                console.log(`✅ ユニークレビュー生成成功 (試行${attempts}回目, 最大類似度: ${(maxSimilarity * 100).toFixed(1)}%)`);
                break;
              }
            } else {
              console.log(`⚠️ 完全重複検出（既存レビューと一致） - 再生成します (試行${attempts}回目)`);
            }
          
          // 再試行の場合は少し待機
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // 最大試行回数に達した場合
        const allExistingTexts = [...existingReviews, ...generatedTexts];
        if (attempts >= maxAttempts && (allExistingTexts.includes(reviewText) || allExistingTexts.some(text => calculateSimilarity(reviewText, text) > 0.6))) {
          console.error(`❌ レビュー ${i + 1}: ${maxAttempts}回試行しても重複を回避できませんでした`);
          reviewText = `【重複回避失敗】${reviewText}`;
          // 最後の試行結果を使用
          if (!finalPromptResult || !finalRandomPattern) {
            finalPromptResult = buildDynamicPrompt(csvConfig, csvConfig.humanPatterns[0], customPrompt);
            finalRandomPattern = csvConfig.humanPatterns[0];
          }
        }
        
        // 最終結果が設定されていない場合のフォールバック
        if (!finalPromptResult || !finalRandomPattern) {
          finalPromptResult = buildDynamicPrompt(csvConfig, csvConfig.humanPatterns[0], customPrompt);
          finalRandomPattern = csvConfig.humanPatterns[0];
        }
        
        // 品質スコア計算
        const selectedElements = {
          area: finalPromptResult.selectedArea,
          businessType: finalPromptResult.selectedBusinessType,
          usps: finalPromptResult.selectedUSPs,
          environment: finalPromptResult.selectedEnvironment,
          subs: finalPromptResult.selectedSubs
        };
        const qualityScore = calculateQualityScore(reviewText, csvConfig, finalRandomPattern, selectedElements);
        
        // 年齢・性別を設定
        const ageGroup = finalRandomPattern.age_group || '20代';
        const ageDecade = parseInt(ageGroup.replace('代', '')); // 年代（10, 20, 30, 40, 50, 60）
        const genderRandom = Math.random();
        const reviewerGender: 'male' | 'female' | 'other' = 
          genderRandom > 0.6 ? 'male' : genderRandom > 0.3 ? 'female' : 'other';
        
        // 使用されたキーワードをバーティカルライン区切りで結合
        const selectedSubs = finalPromptResult.selectedSubs || [];
        const usedWords = [
          finalPromptResult.selectedArea,
          finalPromptResult.selectedBusinessType,
          ...finalPromptResult.selectedUSPs,
          finalPromptResult.selectedEnvironment,
          ...selectedSubs
        ].filter(word => word && word.trim() !== '').join('|');

        generatedReviews.push({
          reviewText: reviewText,
          rating: Math.floor(Math.random() * 2) + 4, // 4-5点のランダム
          reviewerAge: ageDecade,
          reviewerGender: reviewerGender,
          qualityScore: qualityScore / 10, // 0-1スケールに変換
          generationPrompt: finalPromptResult.dynamicPrompt,
          generationParameters: {
            selectedPattern: finalRandomPattern,
            selectedElements: selectedElements,
            targetLength: finalPromptResult.targetLength,
            customPrompt: customPrompt,
            usedWords: usedWords, // 使用されたキーワード（バーティカルライン区切り）
            selectedRecommendation: finalPromptResult.selectedRecommendation // 使用された推奨フレーズ
          },
          csvFileIds: [], // 後で実装
          isApproved: qualityScore >= 7.0
        });

        console.log(`✅ レビュー ${i + 1}/${reviewCount} AI創作完了 (スコア: ${qualityScore}, 文字数: ${reviewText.length})`);
        
        // API制限対策：少し待機
        if (i < reviewCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ レビュー ${i + 1} AI創作エラー:`, error);
        
        // エラー時はスキップして次へ
        generatedReviews.push({
          reviewText: `AI創作エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          rating: 1,
          reviewerAge: 20,
          reviewerGender: 'other',
          qualityScore: 0,
          generationPrompt: '',
          generationParameters: {
            error: true,
            error_message: error instanceof Error ? error.message : 'Unknown error'
          },
          csvFileIds: [],
          isApproved: false
        });
        continue;
      }
    }

    // 品質フィルタリング（スコア0.6未満を除外）
    const filteredReviews = generatedReviews.filter(review => review.qualityScore >= 0.6);

    console.log(`🎉 AI創作完了 - 総数: ${generatedReviews.length}, フィルタ後: ${filteredReviews.length}`);

    if (saveToDB) {
      // データベースにレビューを保存
      for (const review of filteredReviews) {
        try {
          const savedReviewId = await saveGeneratedReview(review);
          // 保存されたレビューのIDを使用して品質ログを記録
          if (savedReviewId) {
            await logQualityCheck(
              savedReviewId,
              'ai_generation',
              review.qualityScore,
              review.qualityScore >= 0.7,
              { generationParams: { csvConfig, customPrompt } }
            );
          }
        } catch (error) {
          console.error('レビュー保存エラー:', error);
        }
      }
    }

    return res.status(200).json(filteredReviews);

  } catch (error) {
    console.error('❌ CSV駆動AI創作システム Error:', error);
    console.error('Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return res.status(500).json({
      error: 'AI創作中に予期しないエラーが発生しました',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
} 