import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';
import Anthropic from '@anthropic-ai/sdk';
import { ReviewRequest, GeneratedReview } from '../types/review';

/**
 * @file ReviewGeneratorAgent
 * @description レビュー生成エージェント。Mastraエージェントフレームワーク実装。Anthropic Claude APIの呼び出しとエラーハンドリングを含む。
 */

export class ReviewGeneratorAgent extends Agent {
  private claude: Anthropic;

  constructor(apiKey: string) {
    super({
      name: 'Review Generator Agent',
      instructions: 'Claude APIを使用して高品質な日本語レビューを生成するエージェント',
      model: anthropic('claude-sonnet-4-20250514')
    });
    this.claude = new Anthropic({ apiKey });
  }

  async generateReview(prompt: string, request: ReviewRequest): Promise<GeneratedReview> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
      const textBlock = response.content.find(block => block.type === 'text');
      const text = textBlock && 'text' in textBlock ? textBlock.text : '';
      
      return {
        reviewText: text,
        rating: 5, // デフォルト値
        reviewerAge: 25, // デフォルト値
        reviewerGender: 'other', // デフォルト値
        qualityScore: 0, // Will be set by QualityControllerAgent
        csvFileIds: [],
        generationPrompt: prompt,
        // CSV出力用フィールド
        companion: request.companion === 'alone' ? '一人' : request.companion || '一人',
        word: request.word || '', // 実際の使用ワードはDynamicPromptBuilderAgentで設定されるべき
        recommend: request.recommend || '日本酒好きに'
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error('ReviewGeneratorAgent: エラー発生', error.message, error.stack);
      } else {
        console.error('ReviewGeneratorAgent: 未知のエラー', error);
      }
      throw error;
    }
  }
}