/**
 * @file QualityControllerAgent
 * @description レビュー品質管理エージェント。Mastraエージェントフレームワーク実装。
 */
import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';

export class QualityControllerAgent extends Agent {
  constructor() {
    super({
      name: 'Quality Controller Agent',
      instructions: '生成されたレビューの品質評価とスコアリングを行うエージェント',
      model: anthropic('claude-sonnet-4-20250514')
    });
  }
  checkQuality(review: GeneratedReview, config: CSVConfig): GeneratedReview {
    let score = 10.0;
    const { basicRules, qaKnowledge } = config;

    // Check required elements
    const requiredElements = basicRules
      .filter(rule => rule.category === 'required_elements')
      .map(rule => rule.content);

    for (const element of requiredElements) {
      if (!review.reviewText.includes(element)) {
        score -= 1.0;
      }
    }

    // Check prohibited expressions
    const prohibitedExpressions = basicRules
      .filter(rule => rule.category === 'prohibited_expressions')
      .map(rule => rule.content);

    for (const expression of prohibitedExpressions) {
      if (review.reviewText.includes(expression)) {
        score -= 2.0;
      }
    }

    // Additional quality checks from qaKnowledge
    const criticalRules = qaKnowledge
      .filter(qa => qa.priority === 'Critical');

    for (const rule of criticalRules) {
      if (review.reviewText.includes(rule.example_before)) {
        score -= 1.5;
      }
    }

    return {
      ...review,
      qualityScore: Math.max(0, score)
    };
  }
}
