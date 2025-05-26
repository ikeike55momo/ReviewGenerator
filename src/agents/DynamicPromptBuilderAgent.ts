import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';
import { CSVConfig } from '../types/csv';
import { ReviewRequest } from '../types/review';

/**
 * @file DynamicPromptBuilderAgent
 * @description プロンプト生成エージェント。Mastraエージェントフレームワーク実装。ReviewRequestからpersonalityType, ageGroup, genderを取得し、型安全にhumanPatternsを検索する。
 */

export class DynamicPromptBuilderAgent extends Agent {
  constructor() {
    super({
      name: 'Dynamic Prompt Builder Agent',
      instructions: 'CSVデータに基づいて動的にプロンプトを構築するエージェント',
      model: anthropic('claude-3-haiku-20240307')
    });
  }

  buildPrompt(config: CSVConfig, request: ReviewRequest): string {
    const { basicRules, humanPatterns, qaKnowledge } = config;

    // Extract required elements
    const requiredElements = basicRules
      .filter(rule => rule.category === 'required_elements')
      .map(rule => rule.content);

    // Get personality pattern
    const pattern = humanPatterns.find(p =>
      p.personality_type === request.personality_type &&
      p.age_group === request.age_group
    );
    if (!pattern) {
      throw new Error(`personalityPatternPrompt: 指定条件に合致するパターンが見つかりません。personalityType=${request.personality_type}, ageGroup=${request.age_group}`);
    }

    const prompt = `
以下の条件で、自然な日本語レビューを1つ生成してください：

対象店舗: SHOGUN BAR（池袋西口のエンタメバー）
年齢層: ${request.age_group}
性別: ${request.gender}
性格タイプ: ${pattern.personality_type}

必須要素:
${requiredElements.map(elem => `- ${elem}`).join('\n')}

使用可能な語彙:
${pattern.vocabulary}

感嘆符使用回数: ${pattern.exclamation_marks}

文体の特徴:
${pattern.characteristics}

禁止表現:
${basicRules
  .filter(rule => rule.category === 'prohibited_expressions')
  .map(rule => `- ${rule.content}`)
  .join('\n')}

以下の例を参考に、自然な日本語で書いてください：
${pattern.example}

`;

    return prompt;
  }
}
