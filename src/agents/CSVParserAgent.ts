/**
 * @file CSVParserAgent
 * @description CSVパースエージェント。Mastraエージェントフレームワーク実装。
 */
import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';
import { parse } from 'csv-parse/sync';
import { CSVConfig } from '../types/csv';

export class CSVParserAgent extends Agent {
  constructor() {
    super({
      name: 'CSV Parser Agent',
      instructions: 'CSVファイルの解析とバリデーションを行うエージェント',
      model: anthropic('claude-3-haiku-20240307')
    });
  }

  private validateHeaders(headers: string[], expectedHeaders: string[]): boolean {
    return expectedHeaders.every(h => headers.includes(h));
  }

  private debugCSVStructure(buffer: Buffer, filename: string): void {
    try {
      const content = buffer.toString('utf-8');
      const lines = content.split('\n').slice(0, 5); // 最初の5行のみ
      
      // ヘッダー行の詳細分析
      const headerLine = lines[0];
      const headers = headerLine ? headerLine.split(',').map(h => h.trim()) : [];
      
      console.log(`CSVデバッグ情報 - ${filename}:`, {
        totalLength: content.length,
        lineCount: content.split('\n').length,
        headers: headers,
        headerCount: headers.length,
        firstFiveLines: lines.map((line, index) => ({
          lineNumber: index + 1,
          content: line,
          columnCount: line.split(',').length
        }))
      });
    } catch (error) {
      console.error(`CSVデバッグエラー - ${filename}:`, error);
    }
  }

  async parseCSVs(files: {
    basicRules: Buffer,
    humanPatterns: Buffer,
    qaKnowledge: Buffer,
    successExamples: Buffer
  }): Promise<CSVConfig> {
    try {
      // デバッグ情報出力
      this.debugCSVStructure(files.basicRules, 'basic_rules.csv');
      this.debugCSVStructure(files.humanPatterns, 'human_patterns.csv');
      this.debugCSVStructure(files.qaKnowledge, 'qa_knowledge.csv');
      this.debugCSVStructure(files.successExamples, 'success_examples.csv');

      // より柔軟なCSVパースオプション
      const parseOptions = {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true, // 列数の不一致を許可
        trim: true, // 前後の空白を削除
        skip_records_with_error: false, // エラー行をスキップしない（デバッグのため）
      };

      const basicRules = parse(files.basicRules, parseOptions);
      const humanPatterns = parse(files.humanPatterns, parseOptions);
      const qaKnowledge = parse(files.qaKnowledge, parseOptions);
      const successExamples = parse(files.successExamples, parseOptions);

      // Validate headers for each CSV file
      if (basicRules.length > 0) {
        const basicRulesHeaders = Object.keys(basicRules[0]);
        const expectedBasicRulesHeaders = ['category', 'type', 'content'];
        if (!this.validateHeaders(basicRulesHeaders, expectedBasicRulesHeaders)) {
          const missingHeaders = expectedBasicRulesHeaders.filter(h => !basicRulesHeaders.includes(h));
          throw new Error(`basic_rules.csv - 必須ヘッダーが不足しています: ${missingHeaders.join(', ')}`);
        }
      }

      if (humanPatterns.length > 0) {
        const humanPatternsHeaders = Object.keys(humanPatterns[0]);
        const expectedHumanPatternsHeaders = ['personality_type', 'age_group', 'gender', 'vocabulary', 'exclamation_marks', 'characteristics', 'example'];
        if (!this.validateHeaders(humanPatternsHeaders, expectedHumanPatternsHeaders)) {
          const missingHeaders = expectedHumanPatternsHeaders.filter(h => !humanPatternsHeaders.includes(h));
          throw new Error(`human_patterns.csv - 必須ヘッダーが不足しています: ${missingHeaders.join(', ')}`);
        }
      }

      if (qaKnowledge.length > 0) {
        const qaKnowledgeHeaders = Object.keys(qaKnowledge[0]);
        const expectedQaKnowledgeHeaders = ['question', 'answer', 'category', 'priority', 'example_situation', 'example_before', 'example_after'];
        if (!this.validateHeaders(qaKnowledgeHeaders, expectedQaKnowledgeHeaders)) {
          const missingHeaders = expectedQaKnowledgeHeaders.filter(h => !qaKnowledgeHeaders.includes(h));
          throw new Error(`qa_knowledge.csv - 必須ヘッダーが不足しています: ${missingHeaders.join(', ')}`);
        }
      }

      if (successExamples.length > 0) {
        const successExamplesHeaders = Object.keys(successExamples[0]);
        const expectedSuccessExamplesHeaders = ['review', 'age', 'gender', 'companion', 'word', 'recommend'];
        if (!this.validateHeaders(successExamplesHeaders, expectedSuccessExamplesHeaders)) {
          const missingHeaders = expectedSuccessExamplesHeaders.filter(h => !successExamplesHeaders.includes(h));
          throw new Error(`success_examples.csv - 必須ヘッダーが不足しています: ${missingHeaders.join(', ')}`);
        }
      }

      return {
        basicRules,
        humanPatterns,
        qaKnowledge,
        successExamples
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error('CSVParserAgent: エラー発生', {
          message: error.message,
          stack: error.stack,
          errorType: error.constructor.name
        });
        
        // より詳細なエラーメッセージを作成
        let detailedMessage = `CSVパースエラー: ${error.message}`;
        
        if (error.message.includes('Invalid Record Length')) {
          detailedMessage += '\n\n解決方法:\n1. CSVファイルの列数を確認してください\n2. 余分なカンマや改行がないか確認してください\n3. 文字エンコーディングがUTF-8であることを確認してください';
        }
        
        throw new Error(detailedMessage);
      } else {
        console.error('CSVParserAgent: 未知のエラー', error);
        throw new Error(`CSVパースエラー: 未知のエラーが発生しました - ${String(error)}`);
      }
    }
  }
}