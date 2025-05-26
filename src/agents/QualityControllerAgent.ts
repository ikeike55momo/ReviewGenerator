/**
 * @file QualityControllerAgent
 * @description レビュー品質管理エージェント。Netlify互換の独立クラス実装。
 */
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';

export class QualityControllerAgent {
  checkQuality(review: GeneratedReview, config: CSVConfig): GeneratedReview {
    let score = 10.0;
    const { basicRules, qaKnowledge } = config;

    // Check required elements
    const requiredElements = basicRules
      .filter(rule => rule.category === 'required_elements')
      .map(rule => rule.content);

    for (const element of requiredElements) {
      if (!review.text.includes(element)) {
        score -= 1.0;
      }
    }

    // Check prohibited expressions
    const prohibitedExpressions = basicRules
      .filter(rule => rule.category === 'prohibited_expressions')
      .map(rule => rule.content);

    for (const expression of prohibitedExpressions) {
      if (review.text.includes(expression)) {
        score -= 2.0;
      }
    }

    // Additional quality checks from qaKnowledge
    const criticalRules = qaKnowledge
      .filter(qa => qa.priority === 'Critical');

    for (const rule of criticalRules) {
      if (review.text.includes(rule.example_before)) {
        score -= 1.5;
      }
    }

    return {
      ...review,
      score: Math.max(0, score)
    };
  }
}
