/**
 * @file IntegratedQualityManager.ts
 * @description 統合品質管理エージェント
 * QAナレッジを活用した包括的品質管理
 * 個別対応ではなく、根本的・予防的な品質管理を実現
 */
import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';
import { CSVConfig } from '../types/csv';
import { GeneratedReview, GenerationParameters } from '../types/review';
import { IntelligentQAKnowledgeAgent } from './IntelligentQAKnowledgeAgent';

/**
 * 品質結果の型定義
 */
interface QualityResult {
  review: GeneratedReview;
  qualityResult: {
    passed: boolean;
    score: number;
    violations: any[];
    recommendations: string[];
  };
  learningPoints: any[];
}

/**
 * バッチ学習結果の型定義
 */
interface BatchLearningResult {
  insights: {
    totalIssues: number;
    newPatterns: number;
    improvementOpportunities: number;
  };
  qaUpdates: any;
  improvementPlan: any;
}

/**
 * 🎯 統合品質管理エージェント
 * QAナレッジベースの品質管理を統括するエージェント。
 * 個別対応ではなく、根本的・予防的な品質管理を実現。
 */
export class IntegratedQualityManager extends Agent {
  private qaKnowledgeAgent: IntelligentQAKnowledgeAgent;
  private qualityHistory: any[] = [];

  constructor() {
    super({
      name: 'Integrated Quality Manager',
      instructions: `
        QAナレッジベースの品質管理を統括するエージェント。
        個別対応ではなく、根本的・予防的な品質管理を実現。
        
        主な責務:
        1. 包括的品質チェックの実行
        2. 品質問題の根本原因分析
        3. 予防的品質改善の提案
        4. 継続的学習による品質向上
        
        品質管理の原則:
        - 問題の早期発見と予防
        - データ駆動の意思決定
        - 継続的改善のサイクル
        - ユーザー体験の最優先
      `,
      model: anthropic('claude-3-haiku-20240307')
    });
    
    this.qaKnowledgeAgent = new IntelligentQAKnowledgeAgent();
  }

  /**
   * 🔄 包括的品質チェック
   */
  async comprehensiveQualityCheck(
    review: GeneratedReview,
    csvConfig: CSVConfig,
    batchContext: any
  ): Promise<QualityResult> {
    try {
      // 1. 従来の品質チェック
      const basicQuality = this.calculateBasicQuality(review, csvConfig);
      
      // 2. QAナレッジベースチェック
      const qaQuality = await this.qaKnowledgeAgent.performQABasedQualityCheck(
        review.reviewText,
        csvConfig.qaKnowledge || []
      );
      
      // 3. 総合判定
      const overallQuality = this.calculateOverallQuality(basicQuality, qaQuality);
      
      // 4. 学習ポイントの抽出
      const learningPoints = this.extractLearningPoints(qaQuality, batchContext);
      
      const enhancedReview: GeneratedReview = {
        ...review,
        qualityScore: overallQuality.score,
        isApproved: qaQuality.passed && overallQuality.score >= 0.7,
        generationParameters: {
          temperature: 0.7,
          maxTokens: 1000,
          ...review.generationParameters,
          qualityBreakdown: {
            basic: basicQuality,
            qaKnowledge: qaQuality,
            overall: overallQuality
          }
        }
      };

      // 品質履歴に記録
      this.qualityHistory.push({
        timestamp: new Date().toISOString(),
        reviewId: review.reviewText.substring(0, 50),
        qualityScore: overallQuality.score,
        passed: qaQuality.passed,
        violations: qaQuality.violations.length
      });

      return {
        review: enhancedReview,
        qualityResult: {
          passed: qaQuality.passed,
          score: overallQuality.score,
          violations: qaQuality.violations,
          recommendations: qaQuality.recommendations
        },
        learningPoints
      };
    } catch (error) {
      console.error('❌ 包括的品質チェックエラー:', error);
      return {
        review: {
          ...review,
          qualityScore: 0,
          isApproved: false
        },
        qualityResult: {
          passed: false,
          score: 0,
          violations: [{
            type: 'システムエラー',
            description: '品質チェック中にエラーが発生しました',
            severity: '高'
          }],
          recommendations: ['システム管理者に連絡してください']
        },
        learningPoints: []
      };
    }
  }

  /**
   * 📊 バッチ完了後の学習・改善
   */
  async performBatchLearning(
    allReviews: GeneratedReview[],
    allQualityResults: any[]
  ): Promise<BatchLearningResult> {
    console.log('📊 バッチ学習開始...', { 
      reviewCount: allReviews.length,
      qualityResultCount: allQualityResults.length 
    });
    
    try {
      // 品質問題の集約
      const qualityIssues = this.aggregateQualityIssues(allQualityResults);
      
      // 新しいパターンの発見
      const newPatterns = await this.discoverNewPatterns(qualityIssues);
      
      // QAナレッジ更新提案
      const qaUpdates = await this.qaKnowledgeAgent.proposeQAUpdates(
        qualityIssues,
        [] // 既存QAナレッジ（実際の実装では適切に渡す）
      );
      
      // 改善計画の策定
      const improvementPlan = this.createImprovementPlan(newPatterns, qaUpdates);
      
      console.log('✅ バッチ学習完了');
      
      return {
        insights: {
          totalIssues: qualityIssues.length,
          newPatterns: newPatterns.length,
          improvementOpportunities: improvementPlan.opportunities?.length || 0
        },
        qaUpdates,
        improvementPlan
      };
    } catch (error) {
      console.error('❌ バッチ学習エラー:', error);
      return {
        insights: {
          totalIssues: 0,
          newPatterns: 0,
          improvementOpportunities: 0
        },
        qaUpdates: {
          newQAEntries: [],
          updateSuggestions: [],
          consolidationOpportunities: []
        },
        improvementPlan: {
          opportunities: [],
          recommendations: []
        }
      };
    }
  }

  /**
   * 基本品質計算
   */
  private calculateBasicQuality(review: GeneratedReview, csvConfig: CSVConfig): any {
    let score = 10.0;
    const issues: string[] = [];

    // 文字数チェック
    const textLength = review.reviewText.length;
    if (textLength < 100) {
      score -= 2.0;
      issues.push('文字数不足');
    } else if (textLength > 500) {
      score -= 1.0;
      issues.push('文字数過多');
    }

    // 必須要素チェック
    const basicRules = csvConfig.basicRules || [];
    const requiredElements = basicRules
      .filter(rule => rule.category === 'required_elements')
      .map(rule => rule.content);

    for (const element of requiredElements) {
      if (!review.reviewText.includes(element)) {
        score -= 1.0;
        issues.push(`必須要素不足: ${element}`);
      }
    }

    // 禁止表現チェック
    const prohibitedExpressions = basicRules
      .filter(rule => rule.category === 'prohibited_expressions')
      .map(rule => rule.content);

    for (const expression of prohibitedExpressions) {
      if (review.reviewText.includes(expression)) {
        score -= 2.0;
        issues.push(`禁止表現使用: ${expression}`);
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: score >= 7.0
    };
  }

  /**
   * 総合品質計算
   */
  private calculateOverallQuality(basicQuality: any, qaQuality: any): any {
    const basicScore = basicQuality.score / 10; // 0-1スケールに正規化
    const qaScore = qaQuality.passed ? 1.0 : 0.5; // QAチェック通過で満点、失敗で半分
    
    // 重み付け平均
    const overallScore = (basicScore * 0.6) + (qaScore * 0.4);
    
    return {
      score: overallScore,
      passed: overallScore >= 0.7,
      breakdown: {
        basic: basicScore,
        qa: qaScore
      }
    };
  }

  /**
   * 学習ポイント抽出
   */
  private extractLearningPoints(qaQuality: any, batchContext: any): any[] {
    const learningPoints: any[] = [];
    
    // 違反から学習ポイントを抽出
    for (const violation of qaQuality.violations || []) {
      learningPoints.push({
        type: 'violation_pattern',
        description: violation.description,
        severity: violation.severity,
        context: batchContext
      });
    }
    
    // 推奨事項から学習ポイントを抽出
    for (const recommendation of qaQuality.recommendations || []) {
      learningPoints.push({
        type: 'improvement_opportunity',
        description: recommendation,
        context: batchContext
      });
    }
    
    return learningPoints;
  }

  /**
   * 品質問題の集約
   */
  private aggregateQualityIssues(allQualityResults: any[]): any[] {
    const issues: any[] = [];
    
    for (const result of allQualityResults) {
      if (result.violations) {
        for (const violation of result.violations) {
          issues.push({
            description: violation.description,
            type: violation.type,
            severity: violation.severity,
            frequency: 1, // 実際の実装では頻度を計算
            impact: violation.severity === '高' ? 'high' : violation.severity === '中' ? 'medium' : 'low',
            example: violation.description
          });
        }
      }
    }
    
    return issues;
  }

  /**
   * 新しいパターンの発見
   */
  private async discoverNewPatterns(qualityIssues: any[]): Promise<any[]> {
    if (qualityIssues.length === 0) {
      return [];
    }
    
    try {
      const patternPrompt = `
以下の品質問題から新しいパターンを発見してください：

品質問題:
${qualityIssues.map((issue, i) => `
問題${i+1}: ${issue.description}
タイプ: ${issue.type}
重要度: ${issue.severity}
`).join('\n')}

以下のJSON形式で新しいパターンを出力してください：
{
  "patterns": [
    {
      "name": "パターン名",
      "description": "パターンの説明",
      "frequency": "高|中|低",
      "preventionStrategy": "予防戦略"
    }
  ]
}
`;

      const result = await this.generate(patternPrompt);
      const parsed = JSON.parse(result.text || result.toString());
      return parsed.patterns || [];
    } catch (error) {
      console.error('❌ パターン発見エラー:', error);
      return [];
    }
  }

  /**
   * 改善計画の策定
   */
  private createImprovementPlan(newPatterns: any[], qaUpdates: any): any {
    const opportunities: any[] = [];
    const recommendations: string[] = [];
    
    // 新しいパターンから改善機会を抽出
    for (const pattern of newPatterns) {
      opportunities.push({
        type: 'pattern_prevention',
        description: `${pattern.name}の予防`,
        strategy: pattern.preventionStrategy,
        priority: pattern.frequency === '高' ? 'high' : 'medium'
      });
    }
    
    // QA更新から改善機会を抽出
    for (const entry of qaUpdates.newQAEntries || []) {
      opportunities.push({
        type: 'qa_enhancement',
        description: `QAナレッジ追加: ${entry.question}`,
        strategy: entry.answer,
        priority: entry.priority === 'Critical' ? 'high' : 'medium'
      });
    }
    
    // 汎用的な推奨事項
    if (opportunities.length > 0) {
      recommendations.push('定期的なQAナレッジの見直しを実施');
      recommendations.push('品質チェックの自動化を強化');
      recommendations.push('予防的品質管理の導入');
    }
    
    return {
      opportunities,
      recommendations,
      priority: opportunities.length > 5 ? 'high' : 'medium'
    };
  }

  /**
   * 品質統計の取得
   */
  getQualityStatistics(): any {
    if (this.qualityHistory.length === 0) {
      return {
        totalChecks: 0,
        averageScore: 0,
        passRate: 0,
        recentTrend: 'unknown'
      };
    }
    
    const totalChecks = this.qualityHistory.length;
    const averageScore = this.qualityHistory.reduce((sum, item) => sum + item.qualityScore, 0) / totalChecks;
    const passedChecks = this.qualityHistory.filter(item => item.passed).length;
    const passRate = passedChecks / totalChecks;
    
    // 最近のトレンド（直近10件と前10件を比較）
    let recentTrend = 'stable';
    if (totalChecks >= 20) {
      const recent10 = this.qualityHistory.slice(-10);
      const previous10 = this.qualityHistory.slice(-20, -10);
      
      const recentAvg = recent10.reduce((sum, item) => sum + item.qualityScore, 0) / 10;
      const previousAvg = previous10.reduce((sum, item) => sum + item.qualityScore, 0) / 10;
      
      if (recentAvg > previousAvg + 0.1) {
        recentTrend = 'improving';
      } else if (recentAvg < previousAvg - 0.1) {
        recentTrend = 'declining';
      }
    }
    
    return {
      totalChecks,
      averageScore: Math.round(averageScore * 100) / 100,
      passRate: Math.round(passRate * 100) / 100,
      recentTrend
    };
  }
} 