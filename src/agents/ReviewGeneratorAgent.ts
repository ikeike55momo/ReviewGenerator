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
      model: anthropic('claude-3-haiku-20240307')
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
        text,
        score: 0, // Will be set by QualityControllerAgent
        metadata: request
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