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
// import https from 'https'; // Netlify Functionsでは使用しない

interface GenerateReviewsRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  batchName?: string;
  saveToDB?: boolean;
  existingTexts?: string[]; // バッチ間重複防止用
  existingWordCombinations?: string[]; // ワード組み合わせ重複防止用
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
  
  // 必須要素をカテゴリ別に抽出（安定化されたロジック）
  const requiredAreas = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')
    ?.map(rule => rule.content) || ['池袋西口'];
  const selectedArea = requiredAreas[Math.floor(Math.random() * requiredAreas.length)];
  
  const businessTypes = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')
    ?.map(rule => rule.content) || ['SHOGUN BAR'];
  const selectedBusinessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  
  // USP要素から禁止されているものを除外
  const allUSPElements = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')
    ?.map(rule => rule.content) || [];
  
  // qa_knowledge.csvで禁止されているUSPを除外
  const prohibitedUSPs = ['侍のコスプレ体験', '将軍', '清酒']; // qa_knowledge.csvから抽出
  const validUSPElements = allUSPElements.filter(usp => !prohibitedUSPs.includes(usp));
  
  // USPから文字数に応じて1-3個を選択
  const uspCount = targetLength <= 200 ? 1 : targetLength <= 300 ? 2 : 3;
  const shuffledUSPs = [...validUSPElements].sort(() => Math.random() - 0.5);
  const selectedUSPs = shuffledUSPs.slice(0, Math.min(uspCount, validUSPElements.length));
  
  const environmentElements = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')
    ?.map(rule => rule.content) || ['アクセス抜群'];
  const selectedEnvironment = environmentElements[Math.floor(Math.random() * environmentElements.length)];
  
  // サブ要素（自由使用）- 禁止要素を除外
  const allSubElements = basicRules
    ?.filter(rule => rule.category === 'required_elements' && rule.type === 'sub')
    ?.map(rule => rule.content) || [];
  
  // qa_knowledge.csvで禁止されているサブ要素を除外
  const prohibitedSubs = ['将軍', '清酒']; // qa_knowledge.csvから抽出
  const validSubElements = allSubElements.filter(sub => !prohibitedSubs.includes(sub));
  
  const subCount = Math.floor(Math.random() * 3); // 0-2個
  const shuffledSubs = [...validSubElements].sort(() => Math.random() - 0.5);
  const selectedSubs = shuffledSubs.slice(0, Math.min(subCount, validSubElements.length));
  
  // 禁止表現を抽出
  const prohibitedExpressions = basicRules
    ?.filter(rule => rule.category === 'prohibited_expressions')
    ?.map(rule => rule.content) || [];
  
  // 推奨フレーズを抽出（レコメンド用）- 安定化されたロジック
  const recommendationPhrases = basicRules
    ?.filter(rule => rule.category === 'recommendation_phrases')
    ?.map(rule => rule.content) || ['日本酒好きに'];
  const selectedRecommendation = recommendationPhrases[Math.floor(Math.random() * recommendationPhrases.length)];
  
  // QA知識ベースを抽出（AI制御用）
  const controlQAKnowledge = qaKnowledge
    ?.filter(qa => qa.priority === 'Critical' || qa.priority === 'High')
    ?.slice(0, 8) || []; // 重要度の高いQA知識を抽出
  
  // 成功例を抽出（同じ年代・性格タイプ優先）
  const relevantSuccessExamples = successExamples
    ?.filter(example => 
      example.age?.includes(selectedPattern.age_group?.replace('代', '')) ||
      example.word === selectedPattern.personality_type
    )
    ?.slice(0, 3) || successExamples?.slice(0, 3) || [];

  // 使用可能ワードの完全リスト化（Claudeアプリ風）
  const availableAreas = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || [];
  const availableBusinessTypes = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || [];
  const availableUSPs = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')?.map(rule => rule.content) || [];
  const availableEnvironments = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')?.map(rule => rule.content) || [];
  const availableSubs = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'sub')?.map(rule => rule.content) || [];
  const availableRecommendations = basicRules?.filter(rule => rule.category === 'recommendation_phrases')?.map(rule => rule.content) || [];

  // Claudeアプリ完全準拠プロンプト
  const dynamicPrompt = `
# Google口コミ生成プロフェッショナル

あなたはGoogle口コミ生成のプロフェッショナルです。特にAI判定されない、人間が書いたような自然な口コミを生成することに長けています。

## 必須要素の使用ルール（厳格遵守）

### 1. area（エリア）
- **使用数**: 1個のみ必須
- **選択肢**: ${availableAreas.join('、')}
- **配置**: 文頭付近で自然に
- **選択されたエリア**: ${selectedArea}

### 2. business_type（業種）
- **使用数**: 1個のみ必須
- **選択肢**: ${availableBusinessTypes.join('、')}
- **配置**: areaと組み合わせて自然に
- **選択された業種**: ${selectedBusinessType}

### 3. usp（独自サービス）
- **使用数**: 何個でも可（自然さ優先）
- **選択肢**: ${availableUSPs.join('、')}
- **配置**: 体験談として自然に組み込む
- **選択されたUSP**: ${selectedUSPs.join('、')}

### 4. environment（環境・設備）
- **使用数**: 1個のみ必須
- **選択肢**: ${availableEnvironments.join('、')}
- **配置**: 体験の流れで自然に言及
- **選択された環境**: ${selectedEnvironment}

${selectedSubs.length > 0 ? `### 5. sub（サブ要素）
- **使用数**: 何個でも可（自然さ優先）
- **選択肢**: ${availableSubs.join('、')}
- **配置**: uspと連携して体験談に組み込む
- **選択されたサブ要素**: ${selectedSubs.join('、')}` : ''}

### 6. phrase（推奨フレーズ）
- **使用数**: 1個必須
- **配置**: 文末に第三者への推奨として必ず配置
- **選択肢**: ${availableRecommendations.join('、')}
- **選択された推奨フレーズ**: ${selectedRecommendation}

## ペルソナ設定

### あなたの人物像
- **年代**: ${selectedPattern.age_group}
- **性格**: ${selectedPattern.personality_type}
- **語彙特徴**: ${selectedPattern.vocabulary}
- **文体特徴**: ${selectedPattern.characteristics}
- **感嘆符使用**: ${selectedPattern.exclamation_marks}
- **参考例**: 「${selectedPattern.example}」

## 【重要】厳格な制約事項

### 絶対に使用禁止のワード
- 上記「選択肢」に記載されていないワード・表現は一切使用禁止
- 勝手な組み合わせ（例：「抹茶カクテルの飲み比べセット」）は禁止
- 関連ワードの追加（例：「カウンター」「席」「テーブル」等）は禁止
- 指定されたワードのみを厳密に使用すること

### 使用必須要素
- area: ${selectedArea}（必ず1回使用）
- business_type: ${selectedBusinessType}（必ず1回使用）
- usp: ${selectedUSPs.join('、')}（自然に使用）
- environment: ${selectedEnvironment}（必ず1回使用）
${selectedSubs.length > 0 ? `- sub: ${selectedSubs.join('、')}（自然に使用）` : ''}
- phrase: ${selectedRecommendation}（文末に必ず配置）

## 生成指示

${targetLength}文字程度で、上記の指定されたワードのみを使用して、${selectedPattern.age_group}の${selectedPattern.personality_type}として自然な口コミを生成してください。

**重要**: 
- 指定されていないワードは絶対に使用せず、選択されたワードのみで創作してください
- 絵文字は使わず、一人で行った体験として書いてください
- 口コミ本文のみを出力し、説明文・補足・文字数カウント・分析は一切不要です
- ※補足、（文字数：）、**説明**などの余計な情報は絶対に追加しないでください

${customPrompt ? `\n追加指示: ${customPrompt}` : ''}
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
  try {
    const requestBody = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.95, // より高い多様性のために温度を上げる
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒タイムアウト

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Claude API Error Response:', errorData);
      throw new Error(`Claude API Error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const responseData = await response.json();
    
    if (responseData.content && responseData.content[0] && responseData.content[0].text) {
      let generatedText = responseData.content[0].text.trim();
      
      // 余計な説明文・注釈を完全除去（より厳密に）
      generatedText = generatedText.replace(/\n\nNote:[\s\S]*$/i, ''); // Note以降を削除
      generatedText = generatedText.replace(/\n注意:[\s\S]*$/i, ''); // 注意以降を削除
      generatedText = generatedText.replace(/\n備考:[\s\S]*$/i, ''); // 備考以降を削除
      generatedText = generatedText.replace(/\n特徴:[\s\S]*$/i, ''); // 特徴以降を削除
      generatedText = generatedText.replace(/\n解説:[\s\S]*$/i, ''); // 解説以降を削除
      generatedText = generatedText.replace(/\n\n.*特徴[\s\S]*$/i, ''); // 特徴説明を削除
      generatedText = generatedText.replace(/Note:[\s\S]*$/i, ''); // 行頭のNoteも削除
      generatedText = generatedText.replace(/^["「]|["」]$/g, ''); // 先頭・末尾のクォート削除
      generatedText = generatedText.replace(/\n{3,}/g, '\n\n'); // 過度な改行を制限
      
      // 🎲 ユニーク性確保の余計な情報を完全除去
      generatedText = generatedText.replace(/\n\n🎲 ユニーク性確保:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/🎲 ユニーク性確保:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/生成ID:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/レビュー番号:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/文字数:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/試行回数:[\s\S]*$/i, '');
      
      // ※補足・説明文・文字数カウントを完全除去
      generatedText = generatedText.replace(/\n\n※補足[\s\S]*$/i, '');
      generatedText = generatedText.replace(/※補足[\s\S]*$/i, '');
      generatedText = generatedText.replace(/\n\n（文字数：[\s\S]*$/i, '');
      generatedText = generatedText.replace(/（文字数：[\s\S]*$/i, '');
      generatedText = generatedText.replace(/\n\n\*\*[\s\S]*$/i, ''); // **で始まる説明文
      generatedText = generatedText.replace(/\*\*[\s\S]*$/i, '');
      
      // 文字化けを修正
      generatedText = generatedText.replace(/���/g, '');
      generatedText = generatedText.replace(/�/g, '');
      
      // 改行で区切られた余計な情報を除去
      const lines = generatedText.split('\n');
      const cleanLines = lines.filter((line: string) => {
        const trimmedLine = line.trim();
        return !trimmedLine.startsWith('生成ID:') &&
               !trimmedLine.startsWith('レビュー番号:') &&
               !trimmedLine.startsWith('文字数:') &&
               !trimmedLine.startsWith('試行回数:') &&
               !trimmedLine.startsWith('※') &&
               !trimmedLine.startsWith('（文字数：') &&
               !trimmedLine.startsWith('- ') && // リスト形式の説明文
               !trimmedLine.includes('🎲') &&
               !trimmedLine.includes('ユニーク性確保') &&
               !trimmedLine.includes('感嘆符:') &&
               !trimmedLine.includes('語彙特徴:') &&
               !trimmedLine.includes('体験の流れ:') &&
               !trimmedLine.includes('指定キーワード') &&
               !trimmedLine.includes('一人称視点') &&
               !trimmedLine.includes('SNS的な表現');
      });
      generatedText = cleanLines.join('\n');
      
      generatedText = generatedText.trim();
      
      console.log('Claude API Success:', { 
        textLength: generatedText.length,
        preview: generatedText.substring(0, 50) + '...'
      });
      return generatedText;
    } else {
      console.error('Unexpected Claude API Response Structure:', responseData);
      throw new Error('Claude APIからの応答形式が予期しないものでした');
    }
  } catch (error) {
    console.error('Claude API Request Error:', error);
    
    // AbortError（タイムアウト）の特別処理
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude APIリクエストがタイムアウトしました（30秒）');
    }
    
    throw new Error(`Claude APIリクエストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 厳格なワード制限チェック関数（Claudeアプリ準拠）
 * 指定されたワード以外の使用を検出
 */
function checkStrictWordCompliance(
  reviewText: string, 
  csvConfig: CSVConfig, 
  selectedElements: {
    selectedArea: string;
    selectedBusinessType: string;
    selectedUSPs: string[];
    selectedEnvironment: string;
    selectedSubs: string[];
    selectedRecommendation: string;
  }
): {
  hasViolation: boolean;
  violations: string[];
} {
  const { basicRules } = csvConfig;
  const violations: string[] = [];
  
  // 使用可能ワードの完全リスト
  const allowedWords = new Set<string>();
  
  // basic_rules.csvから使用可能ワードを抽出
  const areas = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || [];
  const businessTypes = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || [];
  const usps = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')?.map(rule => rule.content) || [];
  const environments = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')?.map(rule => rule.content) || [];
  const subs = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'sub')?.map(rule => rule.content) || [];
  const recommendations = basicRules?.filter(rule => rule.category === 'recommendation_phrases')?.map(rule => rule.content) || [];
  
  // 使用可能ワードをSetに追加
  [...areas, ...businessTypes, ...usps, ...environments, ...subs, ...recommendations].forEach(word => {
    if (word && word.trim()) {
      allowedWords.add(word.trim());
    }
  });
  
  // 一般的な接続詞・助詞・基本語彙を許可リストに追加
  const basicVocabulary = [
    // 基本動詞
    'いく', '行く', '行って', '行った', '来る', '来て', '来た', 'する', 'して', 'した', 'なる', 'なって', 'なった',
    'ある', 'あって', 'あった', 'いる', 'いて', 'いた', 'できる', 'できて', 'できた', 'もらう', 'もらって', 'もらった',
    // 基本形容詞
    'いい', 'よい', '良い', '悪い', '新しい', '古い', '大きい', '小さい', '高い', '安い', '美しい', '綺麗', 'きれい',
    '素晴らしい', 'すごい', 'すばらしい', '最高', '良かった', 'よかった', '嬉しい', '楽しい', '満足',
    // 基本名詞
    '時間', '場所', '人', '店', '店舗', '体験', '感じ', '気持ち', '印象', '雰囲気', '空間', '内装', '照明',
    '料金', '価格', '値段', '予約', '利用', '使用', '今回', '今度', '次回', '一回', '初回', '最初', '最後',
    // 接続詞・副詞
    'また', 'そして', 'それで', 'でも', 'しかし', 'ただ', 'とても', 'すごく', 'かなり', 'ちょっと', '少し',
    'もう', 'まだ', 'やっぱり', 'さすが', '本当に', '実際に', '特に', '普通に', '自然に',
    // 助詞・助動詞
    'は', 'が', 'を', 'に', 'で', 'と', 'から', 'まで', 'より', 'ほど', 'など', 'なども', 'だけ', 'しか',
    'です', 'である', 'だった', 'でした', 'ます', 'ました', 'でしょう', 'だろう'
  ];
  
  basicVocabulary.forEach(word => allowedWords.add(word));
  
  // 禁止ワードの検出（basic_rules.csvに存在しない具体的な名詞・サービス名）
  const prohibitedPatterns = [
    // 勝手に追加されがちなバー関連ワード
    /カウンター/g,
    /テーブル/g,
    /席/g,
    /ボックス/g,
    /個室/g,
    // 勝手な組み合わせ
    /飲み比べセット/g,
    /テイスティングセット/g,
    /ビールの飲み比べ/g,
    /ビール飲み比べ/g,
    /コース/g,
    /メニュー/g,
    // 勝手な修飾語
    /老舗/g,
    /名店/g,
    /有名店/g,
    /人気店/g,
    /話題の/g,
    // 具体的すぎる描写
    /バーテンダー/g,
    /スタッフ/g,
    /店員/g,
    /マスター/g
  ];
  
  // 禁止パターンのチェック
  for (const pattern of prohibitedPatterns) {
    const matches = reviewText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        violations.push(`禁止ワード「${match}」を使用`);
      });
    }
  }
  
  // 必須要素の使用チェック
  if (!reviewText.includes(selectedElements.selectedArea)) {
    violations.push(`必須エリア「${selectedElements.selectedArea}」が未使用`);
  }
  
  if (!reviewText.includes(selectedElements.selectedBusinessType)) {
    violations.push(`必須業種「${selectedElements.selectedBusinessType}」が未使用`);
  }
  
  if (!reviewText.includes(selectedElements.selectedEnvironment)) {
    violations.push(`必須環境「${selectedElements.selectedEnvironment}」が未使用`);
  }
  
  if (!reviewText.includes(selectedElements.selectedRecommendation)) {
    violations.push(`必須推奨フレーズ「${selectedElements.selectedRecommendation}」が未使用`);
  }
  
  return {
    hasViolation: violations.length > 0,
    violations: violations
  };
}

/**
 * QA知識ベース駆動品質チェック関数
 * qa_knowledge.csvのQA形式ナレッジに基づいてレビューの適切性をチェック
 */
function checkQAKnowledgeCompliance(reviewText: string, csvConfig: CSVConfig): {
  hasViolation: boolean;
  violatedRules: string[];
} {
  const { qaKnowledge } = csvConfig;
  const violatedRules: string[] = [];
  
  // QA知識ベースから制御ルールを抽出
  const controlRules = qaKnowledge?.filter(qa => 
    qa.priority === 'Critical' || qa.priority === 'High'
  ) || [];
  
  for (const rule of controlRules) {
    // example_beforeに含まれる問題のある表現をチェック
    if (rule.example_before && reviewText.includes(rule.example_before)) {
      violatedRules.push(`${rule.question}: ${rule.example_before}を使用`);
    }
    
    // QA知識に基づく動的チェック
    if (rule.question && rule.answer) {
      const questionLower = rule.question.toLowerCase();
      const answerLower = rule.answer.toLowerCase();
      const reviewLower = reviewText.toLowerCase();
      
      // 限定的シチュエーションの特別チェック
      if (questionLower.includes('限定的') || questionLower.includes('個人的すぎる')) {
        const limitedScenarioPatterns = [
          /\d+歳の誕生日/,
          /長年の習慣/,
          /人生の節目/,
          /結婚記念日/,
          /昇進祝い/,
          /自宅での晩酌/,
          /毎晩のルーティン/,
          /日課の変更/
        ];
        
        for (const pattern of limitedScenarioPatterns) {
          if (pattern.test(reviewText)) {
            violatedRules.push(`限定的シチュエーション検出: ${pattern.source}`);
          }
        }
      }
      
      // 質問内容に基づいて適切性をチェック
      if (questionLower.includes('使用') && answerLower.includes('避ける')) {
        // example_beforeまたはanswerに含まれる避けるべき表現をチェック
        const avoidTerms = (rule.example_before || '').split(/[、,，]/);
        for (const term of avoidTerms) {
          const cleanTerm = term.trim();
          if (cleanTerm && reviewLower.includes(cleanTerm.toLowerCase())) {
            violatedRules.push(`${rule.question}: ${cleanTerm}を使用`);
          }
        }
      }
      
      // カテゴリベースのチェック
      if (rule.category && rule.category.includes('禁止')) {
        const prohibitedTerms = (rule.example_before || rule.answer || '').split(/[、,，]/);
        for (const term of prohibitedTerms) {
          const cleanTerm = term.trim();
          if (cleanTerm && reviewLower.includes(cleanTerm.toLowerCase())) {
            violatedRules.push(`${rule.category}: ${cleanTerm}を検出`);
          }
        }
      }
    }
  }
  
  return {
    hasViolation: violatedRules.length > 0,
    violatedRules: violatedRules
  };
}

/**
 * 年代の正規化関数
 * human_patterns.csvの年代設定を正しく処理
 */
function normalizeAgeGroup(ageGroup: string): number {
  // 年代文字列の正規化
  const cleanAgeGroup = ageGroup.trim();
  
  // 「60代以上」の特別処理
  if (cleanAgeGroup.includes('60代以上') || cleanAgeGroup.includes('60以上')) {
    return 60;
  }
  
  // 「○代」形式の処理
  const match = cleanAgeGroup.match(/(\d+)代/);
  if (match) {
    const decade = parseInt(match[1]);
    // 有効な年代範囲チェック（10-60）
    if (decade >= 10 && decade <= 60) {
      return decade;
    }
  }
  
  // フォールバック：20代
  console.warn(`⚠️ 不正な年代設定: "${ageGroup}" -> 20代にフォールバック`);
  return 20;
}

/**
 * ワードベース重複チェック関数（完全新設計）
 * 使用されたワードの組み合わせで重複を判定
 */
function checkWordBasedDuplication(
  reviewText: string,
  selectedElements: {
    area: string;
    businessType: string;
    usps: string[];
    environment: string;
    subs: string[];
  },
  existingWordCombinations: string[]
): {
  isDuplicate: boolean;
  wordCombination: string;
} {
  // 使用ワードの組み合わせを生成（順序を統一）
  const usedWords = [
    selectedElements.area,
    selectedElements.businessType,
    ...selectedElements.usps.sort(),
    selectedElements.environment,
    ...selectedElements.subs.sort()
  ].filter(word => word && word.trim() !== '');
  
  const wordCombination = usedWords.join('|');
  
  // 既存の組み合わせと完全一致チェック
  let isDuplicate = existingWordCombinations.includes(wordCombination);
  
  // より厳密なチェック：部分的な重複も検出
  if (!isDuplicate) {
    for (const existingCombination of existingWordCombinations) {
      const existingWords = existingCombination.split('|');
      const currentWords = wordCombination.split('|');
      
      // 80%以上のワードが重複している場合も重複とみなす
      const commonWords = currentWords.filter(word => existingWords.includes(word));
      const overlapRate = commonWords.length / Math.max(currentWords.length, existingWords.length);
      
      if (overlapRate >= 0.8) {
        isDuplicate = true;
        console.log(`⚠️ 高重複率検出: ${(overlapRate * 100).toFixed(1)}% (${commonWords.length}/${Math.max(currentWords.length, existingWords.length)})`);
        break;
      }
    }
  }
  
  return {
    isDuplicate,
    wordCombination
  };
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

  // 必須要素の最低使用回数チェック（basic_rules.csvルール準拠）
  
  // エリア最低使用回数チェック（最低1回）
  const areaCount = (reviewText.match(new RegExp(selectedElements.area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (areaCount === 0) {
    score -= 3.0; // エリア言及なしは重大減点
  }
  
  // 業種最低使用回数チェック（最低1回）
  const businessTypeCount = (reviewText.match(new RegExp(selectedElements.businessType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (businessTypeCount === 0) {
    score -= 3.0; // 業種言及なしは重大減点
  }
  
  // USP最低使用回数チェック（各USP最低1回、文字数に応じて複数回使用可）
  let uspFoundCount = 0;
  let uspTotalMentions = 0;
  for (const usp of selectedElements.usps) {
    const uspCount = (reviewText.match(new RegExp(usp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (uspCount > 0) {
      uspFoundCount++;
      uspTotalMentions += uspCount;
    }
  }
  const uspMissingCount = selectedElements.usps.length - uspFoundCount;
  score -= uspMissingCount * 1.5; // 不足USP1つにつき1.5点減点
  
  // 文字数に応じたUSP複数使用ボーナス
  if (textLength > 250 && uspTotalMentions > selectedElements.usps.length) {
    score += 0.3; // 長文でUSPを複数回言及した場合のボーナス
  }
  
  // 環境要素最低使用回数チェック（最低1回）
  const environmentCount = selectedElements.environment ? 
    (reviewText.match(new RegExp(selectedElements.environment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0;
  if (environmentCount === 0) {
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

// Netlify Functions用のタイムアウト設定
export const config = {
  maxDuration: 60, // 60秒のタイムアウト
};

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
    
    const { csvConfig, reviewCount, customPrompt, batchName, saveToDB, existingTexts, existingWordCombinations }: GenerateReviewsRequest = req.body;

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
    const usedWordCombinations: string[] = []; // ワード組み合わせ重複防止用
    
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
    
    // バッチ間重複防止：既存テキストをマージ
    if (existingTexts && existingTexts.length > 0) {
      existingReviews = [...existingReviews, ...existingTexts];
      console.log(`🔄 バッチ間重複防止: +${existingTexts.length}件追加 (総計: ${existingReviews.length}件)`);
    }
    
    // バッチ間ワード組み合わせ重複防止：既存ワード組み合わせをマージ
    if (existingWordCombinations && existingWordCombinations.length > 0) {
      usedWordCombinations.push(...existingWordCombinations);
      console.log(`🔄 ワード組み合わせ重複防止: +${existingWordCombinations.length}件追加 (総計: ${usedWordCombinations.length}件)`);
    }
    
    console.log(`🚀 ${reviewCount}件のAI創作レビュー生成開始`);
    
    for (let i = 0; i < reviewCount; i++) {
      let reviewText = '';
      let attempts = 0;
      const maxAttempts = 2; // Claudeの判断を信頼し、最小限の再試行
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
          
          // 使用可能ワードの完全リスト表示（デバッグ用）
          const availableWords = {
            areas: csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || [],
            businessTypes: csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || [],
            usps: csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')?.map(rule => rule.content) || [],
            environments: csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')?.map(rule => rule.content) || [],
            subs: csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'sub')?.map(rule => rule.content) || [],
            recommendations: csvConfig.basicRules?.filter(rule => rule.category === 'recommendation_phrases')?.map(rule => rule.content) || []
          };
          
          console.log(`🎯 選択された要素 (レビュー ${i + 1}):`, {
            area: promptResult.selectedArea,
            businessType: promptResult.selectedBusinessType,
            usps: promptResult.selectedUSPs,
            environment: promptResult.selectedEnvironment,
            subs: promptResult.selectedSubs,
            recommendation: promptResult.selectedRecommendation
          });
          
          console.log(`📋 使用可能ワード一覧:`, {
            areas: availableWords.areas,
            businessTypes: availableWords.businessTypes,
            usps: availableWords.usps,
            environments: availableWords.environments,
            subs: availableWords.subs,
            recommendations: availableWords.recommendations
          });
          
          // CSV要素の整合性チェック（スコープ内の変数を使用）
          const currentAreas = csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || [];
          const currentBusinessTypes = csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || [];
          const currentEnvironments = csvConfig.basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')?.map(rule => rule.content) || [];
          
          console.log(`🔍 CSV要素整合性チェック:`, {
            areaValid: currentAreas.includes(promptResult.selectedArea),
            businessTypeValid: currentBusinessTypes.includes(promptResult.selectedBusinessType),
            environmentValid: currentEnvironments.includes(promptResult.selectedEnvironment),
            uspCount: promptResult.selectedUSPs.length,
            subCount: promptResult.selectedSubs.length,
            availableAreas: currentAreas,
            availableBusinessTypes: currentBusinessTypes,
            availableEnvironments: currentEnvironments
          });
          const { dynamicPrompt } = promptResult;
          
          // Claude API呼び出し（クリーンなプロンプトで）
          reviewText = await callClaudeAPI(dynamicPrompt, anthropicApiKey);
          
          // 厳格なワード制限チェック（Claudeアプリ準拠）
          const wordViolationResult = checkStrictWordCompliance(reviewText, csvConfig, {
            selectedArea: promptResult.selectedArea,
            selectedBusinessType: promptResult.selectedBusinessType,
            selectedUSPs: promptResult.selectedUSPs,
            selectedEnvironment: promptResult.selectedEnvironment,
            selectedSubs: promptResult.selectedSubs,
            selectedRecommendation: promptResult.selectedRecommendation
          });
          
          if (wordViolationResult.hasViolation) {
            console.log(`⚠️ 指定ワード外使用検出: ${wordViolationResult.violations.join(', ')} - 再生成します (試行${attempts}回目)`);
            continue; // 再生成
          }
          
          // 基本チェック
          const hasEmoji = /[\uD83C-\uDBFF\uDC00-\uDFFF]+|[\u2600-\u27BF]|😊|🎉|✨/g.test(reviewText);
          const tooShort = reviewText.length < 50;
          
          if (hasEmoji || tooShort) {
            console.log(`⚠️ 基本チェック失敗 (絵文字: ${hasEmoji}, 短すぎ: ${tooShort}) - 再生成します (試行${attempts}回目)`);
            continue; // 再生成
          }
          
          // Claudeの創作力を信頼（重複チェック最小化）
          const allExistingTexts = [...existingReviews, ...generatedTexts];
          const isExactDuplicate = allExistingTexts.some(existing => 
            existing.trim() === reviewText.trim()
          );
          
          if (!isExactDuplicate) {
            generatedTexts.push(reviewText);
            finalPromptResult = promptResult;
            finalRandomPattern = randomPattern;
            console.log(`✅ レビュー生成成功 (試行${attempts}回目) - 文字数: ${reviewText.length}`);
            break;
          } else {
            console.log(`⚠️ 完全一致重複検出 - 再生成します (試行${attempts}回目)`);
          }
          
          // 再試行の場合は少し待機
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        
        // 最大試行回数に達した場合は最後の結果を使用
        if (attempts >= maxAttempts && (!finalPromptResult || !finalRandomPattern)) {
          console.warn(`⚠️ レビュー ${i + 1}: ${maxAttempts}回試行完了 - 最後の結果を使用`);
          // 最後の試行結果を使用
          if (reviewText && reviewText.length > 50) {
            // 新しいパターンで最後の試行
            const lastRandomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
            const lastPromptResult = buildDynamicPrompt(csvConfig, lastRandomPattern, customPrompt);
            finalPromptResult = lastPromptResult;
            finalRandomPattern = lastRandomPattern;
            generatedTexts.push(reviewText);
          } else {
            console.error(`❌ レビュー ${i + 1}: 有効な結果なし - スキップします`);
            continue;
          }
        }
        
        // 最終結果が設定されていない場合のフォールバック
        if (!finalPromptResult || !finalRandomPattern) {
          console.error(`❌ レビュー ${i + 1}: 最終結果が設定されていません - スキップします`);
          continue; // このレビューをスキップ
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
        
        // 年齢・性別を設定（正規化関数を使用）
        const ageGroup = finalRandomPattern.age_group || '20代';
        const ageDecade = normalizeAgeGroup(ageGroup); // 正規化された年代（10, 20, 30, 40, 50, 60）
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
        
        // デバッグログ：usedWords生成の詳細
        console.log(`🔍 usedWords生成 (レビュー ${i + 1}):`, {
          selectedArea: finalPromptResult.selectedArea,
          selectedBusinessType: finalPromptResult.selectedBusinessType,
          selectedUSPs: finalPromptResult.selectedUSPs,
          selectedEnvironment: finalPromptResult.selectedEnvironment,
          selectedSubs: selectedSubs,
          usedWords: usedWords,
          usedWordsLength: usedWords.length
        });

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