/**
 * @file generate-reviews-qa-enhanced.ts
 * @description QAナレッジ強化版レビュー生成APIエンドポイント
 * 知的QAナレッジシステムを統合した高品質レビュー生成
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';
import { GeneratedReview } from '../../types/review';
import { QAIntegrationHelper, SimpleQAIntegration } from '../../utils/qa-integration-helper';
import { IntelligentQAKnowledgeAgent } from '../../agents/IntelligentQAKnowledgeAgent';
import { IntegratedQualityManager } from '../../agents/IntegratedQualityManager';
import { EnhancedQAProhibitionController } from '../../agents/EnhancedQAProhibitionController';

export const config = {
  maxDuration: 300, // 5分
};

interface QAEnhancedRequest {
  csvConfig: CSVConfig;
  reviewCount: number;
  customPrompt?: string;
  enableQAEnhancement?: boolean;
  qualityThreshold?: number;
}

/**
 * Claude API呼び出し関数（QA強化版）
 */
async function callClaudeAPIWithQA(prompt: string, apiKey: string): Promise<string> {
  try {
    const requestBody = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      temperature: 0.9,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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
      throw new Error(`Claude API Error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const responseData = await response.json();
    
    if (responseData.content && responseData.content[0] && responseData.content[0].text) {
      let generatedText = responseData.content[0].text.trim();
      
      // 余計な説明文・注釈を除去
      generatedText = generatedText.replace(/\n\nNote:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/\n注意:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/\n備考:[\s\S]*$/i, '');
      generatedText = generatedText.replace(/※補足[\s\S]*$/i, '');
      generatedText = generatedText.replace(/（文字数：[\s\S]*$/i, '');
      generatedText = generatedText.replace(/^["「]|["」]$/g, '');
      
      return generatedText.trim();
    } else {
      throw new Error('Claude APIからの応答形式が予期しないものでした');
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude APIリクエストがタイムアウトしました（45秒）');
    }
    throw new Error(`Claude APIリクエストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 基本プロンプト生成（簡略版）
 */
function buildBasicPrompt(csvConfig: CSVConfig, selectedPattern: any): string {
  const { basicRules } = csvConfig;
  
  // 基本要素を抽出
  const areas = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'area')?.map(rule => rule.content) || ['池袋西口'];
  const businessTypes = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'business_type')?.map(rule => rule.content) || ['SHOGUN BAR'];
  const usps = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'usp')?.map(rule => rule.content) || ['日本酒'];
  const environments = basicRules?.filter(rule => rule.category === 'required_elements' && rule.type === 'environment')?.map(rule => rule.content) || ['アクセス抜群'];
  const recommendations = basicRules?.filter(rule => rule.category === 'recommendation_phrases')?.map(rule => rule.content) || ['日本酒好きに'];
  
  const selectedArea = areas[Math.floor(Math.random() * areas.length)];
  const selectedBusinessType = businessTypes[Math.floor(Math.random() * businessTypes.length)];
  const selectedUSP = usps[Math.floor(Math.random() * usps.length)];
  const selectedEnvironment = environments[Math.floor(Math.random() * environments.length)];
  const selectedRecommendation = recommendations[Math.floor(Math.random() * recommendations.length)];
  
  return `
# Google口コミ生成（QA強化版）

以下の条件でGoogle口コミを生成してください：

## 必須要素
- エリア: ${selectedArea}
- 業種: ${selectedBusinessType}
- 特徴: ${selectedUSP}
- 環境: ${selectedEnvironment}
- 推奨: ${selectedRecommendation}

## ペルソナ
- 年代: ${selectedPattern.age_group}
- 性格: ${selectedPattern.personality_type}

## 要件
- 150-300文字程度
- 自然で人間らしい表現
- 絵文字は使用しない
- 体験談として記述
- 文末に推奨フレーズを含める

自然で魅力的なGoogle口コミを生成してください。
`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🧠 QA強化版レビュー生成API呼び出し開始');

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      csvConfig, 
      reviewCount, 
      customPrompt, 
      enableQAEnhancement = true,
      qualityThreshold = 0.7 
    }: QAEnhancedRequest = req.body;

    // 入力バリデーション
    if (!csvConfig || !reviewCount) {
      return res.status(400).json({ 
        error: 'csvConfigとreviewCountは必須です'
      });
    }

    // 環境変数チェック
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY環境変数が設定されていません'
      });
    }

    console.log('🚀 QA強化版レビュー生成開始:', { 
      reviewCount, 
      enableQAEnhancement,
      qualityThreshold 
    });

    // QAナレッジエージェントの初期化
    const qaAgent = new IntelligentQAKnowledgeAgent();
    const qualityManager = new IntegratedQualityManager();
    const enhancedProhibitionController = new EnhancedQAProhibitionController();
    
    // QAナレッジ分析（事前分析）
    let qaAnalysis: any = null;
    if (enableQAEnhancement && csvConfig.qaKnowledge && csvConfig.qaKnowledge.length > 0) {
      console.log('🔍 QAナレッジ事前分析開始...');
      
      // 1. 従来のQAナレッジ分析
      qaAnalysis = await qaAgent.analyzeQAKnowledge(csvConfig.qaKnowledge);
      
      // 2. 強化されたQA禁止事項制御システム初期化
      await qaAgent.initializeEnhancedProhibitionSystem(csvConfig.qaKnowledge);
      
      // 3. 強化された禁止ルール生成
      const prohibitionRules = enhancedProhibitionController.generateProhibitionRules(csvConfig.qaKnowledge);
      
      console.log('✅ QAナレッジ事前分析完了:', {
        パターン数: qaAnalysis.commonPatterns.length,
        ルール数: qaAnalysis.prohibitionRules.length,
        強化された禁止ルール数: prohibitionRules.length
      });
    }

    const generatedReviews: GeneratedReview[] = [];
    const qualityResults: any[] = [];
    const maxCount = Math.min(reviewCount, 20); // QA強化版では20件まで

    for (let i = 0; i < maxCount; i++) {
      try {
        console.log(`📝 レビュー ${i + 1}/${maxCount} 生成中...`);
        
        // ランダムペルソナ選択
        const randomPattern = csvConfig.humanPatterns[Math.floor(Math.random() * csvConfig.humanPatterns.length)];
        
        // 基本プロンプト生成
        let prompt = buildBasicPrompt(csvConfig, randomPattern);
        
        // 🧠 QAナレッジでプロンプト強化
        if (enableQAEnhancement && csvConfig.qaKnowledge) {
          prompt = QAIntegrationHelper.buildQAEnhancedPrompt(
            prompt,
            csvConfig.qaKnowledge,
            qualityResults.slice(-3) // 最近の品質結果を参考
          );
          console.log(`🧠 プロンプトQA強化完了 (${i + 1}件目)`);
        }
        
        // カスタムプロンプト追加
        if (customPrompt) {
          prompt += `\n\n追加指示: ${customPrompt}`;
        }
        
        // Claude API呼び出し
        const reviewText = await callClaudeAPIWithQA(prompt, anthropicApiKey);
        
        // レビューオブジェクト作成
        const review: GeneratedReview = {
          reviewText: reviewText,
          rating: Math.floor(Math.random() * 2) + 4, // 4-5点
          reviewerAge: parseInt(randomPattern.age_group?.replace('代', '') || '20'),
          reviewerGender: (Math.random() > 0.5 ? 'male' : 'female') as 'male' | 'female' | 'other',
          qualityScore: 0.8, // 仮の値、後で更新
          csvFileIds: [],
          createdAt: new Date().toISOString(),
          generationParameters: {
            pattern: randomPattern,
            qaEnhanced: enableQAEnhancement,
            prompt: prompt.substring(0, 200) + '...'
          }
        };
        
        // 🛡️ QA強化品質チェック
        if (enableQAEnhancement && csvConfig.qaKnowledge) {
          console.log(`🛡️ QA品質チェック実行中 (${i + 1}件目)...`);
          
          const qualityResult = await qualityManager.comprehensiveQualityCheck(
            review,
            csvConfig,
            { batchIndex: i, totalBatch: maxCount }
          );
          
          // 品質結果を反映
          review.qualityScore = qualityResult.qualityResult.score;
          review.isApproved = qualityResult.qualityResult.passed;
          
          qualityResults.push(qualityResult.qualityResult);
          
          console.log(`✅ QA品質チェック完了 (${i + 1}件目):`, {
            passed: qualityResult.qualityResult.passed,
            score: qualityResult.qualityResult.score.toFixed(2),
            violations: qualityResult.qualityResult.violations.length
          });
          
          // 品質基準を満たさない場合はスキップ
          if (qualityResult.qualityResult.score < qualityThreshold) {
            console.log(`⚠️ 品質基準未達のためスキップ (${i + 1}件目): ${qualityResult.qualityResult.score.toFixed(2)} < ${qualityThreshold}`);
            continue;
          }
        }
        
        generatedReviews.push(review);
        
        // API呼び出し間隔
        if (i < maxCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ レビュー ${i + 1} 生成エラー:`, error);
        continue;
      }
    }

    // 📊 バッチ品質分析
    let batchAnalysis: any = null;
    if (enableQAEnhancement && generatedReviews.length > 0) {
      console.log('📊 バッチ品質分析開始...');
      batchAnalysis = await QAIntegrationHelper.analyzeBatchQuality(
        generatedReviews,
        csvConfig
      );
      console.log('✅ バッチ品質分析完了:', {
        全体品質: batchAnalysis.overallQuality.toFixed(2),
        合格率: (batchAnalysis.passRate * 100).toFixed(1) + '%',
        共通問題数: batchAnalysis.commonIssues.length
      });
    }

    // 📈 改善提案生成
    let improvementSuggestions: any = null;
    if (enableQAEnhancement && batchAnalysis) {
      console.log('📈 改善提案生成中...');
      improvementSuggestions = await QAIntegrationHelper.generateImprovementSuggestions(
        batchAnalysis,
        csvConfig
      );
      console.log('✅ 改善提案生成完了:', {
        即座対応: improvementSuggestions.immediateActions.length,
        長期改善: improvementSuggestions.longTermImprovements.length
      });
    }

    console.log(`🎉 QA強化版レビュー生成完了: ${generatedReviews.length}件`);

    return res.status(200).json({
      success: true,
      reviews: generatedReviews,
      count: generatedReviews.length,
      qaEnhancement: {
        enabled: enableQAEnhancement,
        qualityThreshold,
        qaAnalysis,
        batchAnalysis,
        improvementSuggestions
      },
      statistics: {
        totalGenerated: generatedReviews.length,
        averageQuality: generatedReviews.length > 0 ? 
          generatedReviews.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / generatedReviews.length : 0,
        approvedCount: generatedReviews.filter(r => r.isApproved).length
      }
    });

  } catch (error) {
    console.error('❌ QA強化版レビュー生成エラー:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'QA enhanced review generation failed'
    });
  }
} 