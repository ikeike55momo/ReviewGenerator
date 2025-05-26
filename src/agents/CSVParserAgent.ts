/**
 * @file CSVParserAgent
 * @description CSVパースエージェント。Mastraエージェントフレームワーク使用。
 */
import { parse } from 'csv-parse/sync';
import { CSVConfig } from '../types/csv';
import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';

export class CSVParserAgent extends Agent {
  constructor() {
    super({
      name: 'CSV Parser Agent',
      instructions: 'CSVパースエージェント。CSVファイルの解析とバリデーションを行います。',
      model: anthropic('claude-3-haiku-20240307'),
    });
  }

  private validateHeaders(headers: string[], expectedHeaders: string[]): boolean {
    return expectedHeaders.every(h => headers.includes(h));
  }

  async parseCSVs(files: {
    basicRules: Buffer,
    humanPatterns: Buffer,
    qaKnowledge: Buffer,
    successExamples: Buffer
  }): Promise<CSVConfig> {
    try {
      const basicRules = parse(files.basicRules, {
        columns: true,
        skip_empty_lines: true
      });

      const humanPatterns = parse(files.humanPatterns, {
        columns: true,
        skip_empty_lines: true
      });

      const qaKnowledge = parse(files.qaKnowledge, {
        columns: true,
        skip_empty_lines: true
      });

      const successExamples = parse(files.successExamples, {
        columns: true,
        skip_empty_lines: true
      });

      // Validate headers
      if (!this.validateHeaders(Object.keys(basicRules[0]), ['category', 'type', 'content'])) {
        throw new Error('Invalid basic_rules.csv headers');
      }

      return {
        basicRules,
        humanPatterns,
        qaKnowledge,
        successExamples
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error('CSVParserAgent: エラー発生', error.message, error.stack);
      } else {
        console.error('CSVParserAgent: 未知のエラー', error);
      }
      throw error;
    }
  }
}