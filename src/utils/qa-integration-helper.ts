/**
 * @file qa-integration-helper.ts
 * @description QAナレッジシステム統合ヘルパー
 * 既存システムへの統合を簡単にするためのユーティリティ関数群
 */
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';
import { IntelligentQAKnowledgeAgent } from '../agents/IntelligentQAKnowledgeAgent';
import { IntegratedQualityManager } from '../agents/IntegratedQualityManager';

/**
 * 🛠️ 既存システムへの統合ヘルパー
 */
export class QAIntegrationHelper {
  private static qaKnowledgeAgent: IntelligentQAKnowledgeAgent | null = null;
  private static qualityManager: IntegratedQualityManager | null = null;

  /**
   * エージェントの初期化
   */
  private static initializeAgents() {
    if (!this.qaKnowledgeAgent) {
      this.qaKnowledgeAgent = new IntelligentQAKnowledgeAgent();
    }
    if (!this.qualityManager) {
      this.qualityManager = new IntegratedQualityManager();
    }
  }

  /**
   * 🔧 既存のQuality Controllerを拡張
   * 既存の品質チェック機能にQAナレッジベースの機能を追加
   */
  static enhanceExistingQualityController(
    existingQualityController: any,
    csvConfig: CSVConfig
  ) {
    this.initializeAgents();
    
    // 既存のcheckQualityメソッドを拡張
    const originalCheckQuality = existingQualityController.checkQuality?.bind(existingQualityController);
    
    if (originalCheckQuality) {
      existingQualityController.checkQuality = async function(review: GeneratedReview, config: CSVConfig) {
        // 1. 従来の品質チェック
        const basicResult = originalCheckQuality(review, config);
        
        // 2. QAナレッジベースチェック
        const qaResult = await QAIntegrationHelper.qaKnowledgeAgent!.performQABasedQualityCheck(
          review.reviewText,
          config.qaKnowledge || []
        );
        
        // 3. 統合結果
        return {
          ...basicResult,
          qaKnowledgeCheck: qaResult,
          finalPassed: basicResult.qualityScore >= 7.0 && qaResult.passed,
          comprehensiveScore: (basicResult.qualityScore + (qaResult.passed ? 10 : 5)) / 2,
          recommendations: qaResult.recommendations,
          violations: qaResult.violations
        };
      };
    }
    
    return existingQualityController;
  }

  /**
   * 🧠 QAナレッジの動的プロンプト統合
   * 基本プロンプトにQAナレッジを統合して強化されたプロンプトを生成
   */
  static buildQAEnhancedPrompt(
    basePrompt: string,
    qaKnowledge: any[],
    recentIssues: any[] = []
  ): string {
    // 重要度の高いQAナレッジを抽出
    const criticalQA = qaKnowledge
      .filter(qa => qa.priority === 'Critical')
      .slice(0, 5);
    
    const highQA = qaKnowledge
      .filter(qa => qa.priority === 'High')
      .slice(0, 3);
    
    // 最近の問題からの学習
    const recentLearnings = recentIssues
      .slice(-3)
      .map(issue => `- ${issue.preventiveGuidance || issue.description}`)
      .join('\n');

    return `
${basePrompt}

# 🛡️ QAナレッジベース品質管理

## 絶対に避けるべき問題（Critical）
${criticalQA.map(qa => `
❌ ${qa.question}
✅ ${qa.answer}
${qa.example_before ? `悪い例: ${qa.example_before}` : ''}
${qa.example_after ? `良い例: ${qa.example_after}` : ''}
`).join('\n')}

## 注意すべき点（High Priority）
${highQA.map(qa => `
⚠️ ${qa.question}
→ ${qa.answer}
`).join('\n')}

## 最近の学習事項
${recentLearnings || '特になし'}

## 重要な最終指示
上記のQAナレッジに基づき、過去の問題を繰り返さない高品質な口コミを生成してください。
特にCritical項目は絶対に遵守してください。
`;
  }

  /**
   * 📊 バッチ品質分析
   * 生成されたレビューのバッチ全体の品質を分析
   */
  static async analyzeBatchQuality(
    reviews: GeneratedReview[],
    csvConfig: CSVConfig
  ): Promise<{
    overallQuality: number;
    passRate: number;
    commonIssues: any[];
    recommendations: string[];
    learningPoints: any[];
  }> {
    this.initializeAgents();
    
    const qualityResults: any[] = [];
    let totalScore = 0;
    let passedCount = 0;
    
    // 各レビューの品質チェック
    for (const review of reviews) {
      try {
        const qaResult = await this.qaKnowledgeAgent!.performQABasedQualityCheck(
          review.reviewText,
          csvConfig.qaKnowledge || []
        );
        
        qualityResults.push(qaResult);
        totalScore += review.qualityScore || 0;
        if (qaResult.passed) passedCount++;
      } catch (error) {
        console.error('品質チェックエラー:', error);
      }
    }
    
    // 共通問題の抽出
    const allViolations = qualityResults.flatMap(result => result.violations || []);
    const violationCounts = allViolations.reduce((acc, violation) => {
      const key = violation.type || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const commonIssues = Object.entries(violationCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([type, count]) => ({ type, count: count as number, frequency: (count as number) / reviews.length }));
    
    // 推奨事項の集約
    const allRecommendations = qualityResults.flatMap(result => result.recommendations || []);
    const uniqueRecommendations = Array.from(new Set(allRecommendations)).slice(0, 10);
    
    // 学習ポイントの抽出
    const learningPoints = commonIssues.map(issue => ({
      type: 'common_issue',
      description: `${issue.type}が${issue.count}件発生（${(issue.frequency * 100).toFixed(1)}%）`,
      priority: issue.frequency > 0.3 ? 'high' : issue.frequency > 0.1 ? 'medium' : 'low'
    }));
    
    return {
      overallQuality: reviews.length > 0 ? totalScore / reviews.length : 0,
      passRate: reviews.length > 0 ? passedCount / reviews.length : 0,
      commonIssues,
      recommendations: uniqueRecommendations,
      learningPoints
    };
  }

  /**
   * 🔄 リアルタイム品質監視
   * 生成中のレビューをリアルタイムで監視し、問題を早期発見
   */
  static async monitorReviewQuality(
    review: GeneratedReview,
    csvConfig: CSVConfig,
    context: {
      batchIndex: number;
      totalBatch: number;
      recentReviews: GeneratedReview[];
    }
  ): Promise<{
    shouldContinue: boolean;
    qualityAlert?: string;
    recommendations: string[];
    adjustments: any;
  }> {
    this.initializeAgents();
    
    try {
      // QAベース品質チェック
      const qaResult = await this.qaKnowledgeAgent!.performQABasedQualityCheck(
        review.reviewText,
        csvConfig.qaKnowledge || []
      );
      
      // 品質トレンドの分析
      const recentScores = context.recentReviews.map(r => r.qualityScore || 0);
      const averageScore = recentScores.length > 0 ? 
        recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length : 0;
      
      // 品質低下の検出
      const qualityAlert = this.detectQualityDegradation(qaResult, averageScore, context);
      
      // 調整提案
      const adjustments = this.suggestAdjustments(qaResult, context);
      
      return {
        shouldContinue: qaResult.passed && !qualityAlert,
        qualityAlert,
        recommendations: qaResult.recommendations,
        adjustments
      };
    } catch (error) {
      console.error('リアルタイム品質監視エラー:', error);
      return {
        shouldContinue: true,
        recommendations: [],
        adjustments: {}
      };
    }
  }

  /**
   * 📈 品質改善提案
   * 品質分析結果に基づいて具体的な改善提案を生成
   */
  static async generateImprovementSuggestions(
    qualityAnalysis: any,
    csvConfig: CSVConfig
  ): Promise<{
    immediateActions: string[];
    longTermImprovements: string[];
    qaUpdates: any;
    processOptimizations: string[];
  }> {
    this.initializeAgents();
    
    const immediateActions: string[] = [];
    const longTermImprovements: string[] = [];
    const processOptimizations: string[] = [];
    
    // 即座に対応すべき問題
    if (qualityAnalysis.passRate < 0.7) {
      immediateActions.push('品質基準の見直しと強化');
      immediateActions.push('プロンプトの改善');
    }
    
    if (qualityAnalysis.commonIssues.length > 0) {
      const topIssue = qualityAnalysis.commonIssues[0];
      immediateActions.push(`${topIssue.type}問題の緊急対策`);
    }
    
    // 長期的な改善
    longTermImprovements.push('QAナレッジベースの継続的更新');
    longTermImprovements.push('品質監視システムの自動化');
    longTermImprovements.push('予防的品質管理の導入');
    
    // プロセス最適化
    processOptimizations.push('品質チェックの並列化');
    processOptimizations.push('学習データの蓄積と活用');
    processOptimizations.push('フィードバックループの強化');
    
    // QAナレッジ更新提案
    const qaUpdates = await this.qaKnowledgeAgent!.proposeQAUpdates(
      qualityAnalysis.learningPoints,
      csvConfig.qaKnowledge || []
    );
    
    return {
      immediateActions,
      longTermImprovements,
      qaUpdates,
      processOptimizations
    };
  }

  /**
   * 品質低下の検出
   */
  private static detectQualityDegradation(
    qaResult: any,
    averageScore: number,
    context: any
  ): string | undefined {
    // 重大な違反の検出
    const criticalViolations = qaResult.violations?.filter(
      (v: any) => v.severity === '高'
    ) || [];
    
    if (criticalViolations.length > 0) {
      return `重大な品質問題を検出: ${criticalViolations[0].description}`;
    }
    
    // 品質スコアの急激な低下
    if (averageScore > 0.7 && (qaResult.score || 0) < 0.5) {
      return '品質スコアの急激な低下を検出';
    }
    
    // バッチ進行中の品質トレンド
    if (context.batchIndex > 5 && averageScore < 0.6) {
      return 'バッチ全体の品質低下傾向を検出';
    }
    
    return undefined;
  }

  /**
   * 調整提案の生成
   */
  private static suggestAdjustments(qaResult: any, context: any): any {
    const adjustments: any = {};
    
    // 違反パターンに基づく調整
    const violationTypes = qaResult.violations?.map((v: any) => v.type) || [];
    
    if (violationTypes.includes('表現パターン違反')) {
      adjustments.promptAdjustment = '表現の多様性を高める指示を追加';
    }
    
    if (violationTypes.includes('内容パターン違反')) {
      adjustments.contentGuidance = '内容の具体性を高める指示を追加';
    }
    
    // バッチ進行状況に基づく調整
    if (context.batchIndex > context.totalBatch * 0.5) {
      adjustments.diversityBoost = '後半バッチの多様性向上';
    }
    
    return adjustments;
  }
}

/**
 * 📋 QAナレッジCSV最適化提案
 */
export const QA_CSV_OPTIMIZATION = {
  
  /**
   * 効果的なCSV構造
   */
  recommendedStructure: {
    columns: [
      'question',      // 問題の質問
      'answer',        // 解決策・回答
      'category',      // カテゴリ（表現|内容|構造|その他）
      'priority',      // 優先度（Critical|High|Medium|Low）
      'pattern_type',  // パターンタイプ（個別|汎用|予防的）
      'root_cause',    // 根本原因
      'prevention_level', // 予防効果レベル
      'example_situation',
      'example_before',
      'example_after',
      'created_date',  // 作成日
      'effectiveness_score' // 効果スコア
    ]
  },
  
  /**
   * カテゴリ分類の推奨
   */
  recommendedCategories: {
    '表現問題': '不適切な表現、誤字脱字、文体の問題',
    '内容問題': '事実誤認、誇張、不適切な内容',
    '構造問題': '文章構成、論理性、読みやすさの問題',
    '規制問題': '法的・規制的な問題',
    '業界固有問題': '業界特有のルールや慣習に関する問題'
  },
  
  /**
   * 効果的なQA記述例
   */
  exampleQA: {
    question: "レビューで具体的でない曖昧な表現を避けるには？",
    answer: "具体的な体験や数値、固有名詞を含めて説得力を高める",
    category: "表現問題",
    priority: "High",
    pattern_type: "汎用",
    root_cause: "体験の具体性不足",
    prevention_level: "高",
    example_situation: "サービス体験のレビュー作成時",
    example_before: "とても良かったです。満足でした。",
    example_after: "スタッフの丁寧な対応で、待ち時間も5分程度と短く、料理も熱々で提供されました。"
  },

  /**
   * CSV品質チェック
   */
  validateQAKnowledge(qaKnowledge: any[]): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // 必須フィールドのチェック
    const requiredFields = ['question', 'answer', 'category', 'priority'];
    for (const qa of qaKnowledge) {
      for (const field of requiredFields) {
        if (!qa[field]) {
          issues.push(`必須フィールド不足: ${field}`);
        }
      }
    }
    
    // 優先度の分布チェック
    const priorityCounts = qaKnowledge.reduce((acc, qa) => {
      acc[qa.priority] = (acc[qa.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if ((priorityCounts.Critical || 0) < 3) {
      suggestions.push('Critical優先度のQAを3件以上追加することを推奨');
    }
    
    if ((priorityCounts.High || 0) < 5) {
      suggestions.push('High優先度のQAを5件以上追加することを推奨');
    }
    
    // カテゴリの多様性チェック
    const categories = new Set(qaKnowledge.map(qa => qa.category));
    if (categories.size < 3) {
      suggestions.push('より多様なカテゴリのQAを追加することを推奨');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }
};

/**
 * 🚀 簡単統合API
 * 既存システムに最小限の変更で統合できるシンプルなAPI
 */
export class SimpleQAIntegration {
  
  /**
   * ワンライン品質チェック
   */
  static async quickQualityCheck(
    reviewText: string,
    qaKnowledge: any[]
  ): Promise<{ passed: boolean; score: number; issues: string[] }> {
    const helper = new QAIntegrationHelper();
    const agent = new IntelligentQAKnowledgeAgent();
    
    try {
      const result = await agent.performQABasedQualityCheck(reviewText, qaKnowledge);
      return {
        passed: result.passed,
        score: result.violations.length === 0 ? 1.0 : 0.5,
        issues: result.violations.map(v => v.description)
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        issues: ['品質チェック中にエラーが発生しました']
      };
    }
  }
  
  /**
   * プロンプト強化（ワンライン）
   */
  static enhancePrompt(basePrompt: string, qaKnowledge: any[]): string {
    return QAIntegrationHelper.buildQAEnhancedPrompt(basePrompt, qaKnowledge);
  }
} 