/**
 * @file csv-loader.ts
 * @description CSV自動読み込みユーティリティ
 * 主な機能：本番環境でのデフォルトCSVファイル読み込み、パース、バリデーション
 * 制限事項：public/data/配下のCSVファイルを対象、エラーハンドリング対応
 */
import { parse } from 'csv-parse/sync';
import { CSVConfig } from '../types/csv';
import fs from 'fs';
import path from 'path';

/**
 * デフォルトCSVファイルのパス定義
 */
const DEFAULT_CSV_PATHS = {
  basicRules: '/data/basic_rules.csv',
  humanPatterns: '/data/human_patterns.csv',
  qaKnowledge: '/data/qa_knowledge.csv',
  successExamples: '/data/success_examples.csv',
} as const;

/**
 * CSVファイルを読み込んでパースする
 * @param filePath ファイルパス
 * @returns パース済みCSVデータ
 */
async function loadCSVFile(filePath: string): Promise<any[]> {
  try {
    let csvContent: string;
    
    // 本番環境（Vercel）での読み込み
    if (process.env.NODE_ENV === 'production') {
      // public/data/配下のファイルを読み込み
      const publicPath = path.join(process.cwd(), 'public', filePath);
      csvContent = fs.readFileSync(publicPath, 'utf-8');
    } else {
      // 開発環境での読み込み
      const devPath = path.join(process.cwd(), 'public', filePath);
      csvContent = fs.readFileSync(devPath, 'utf-8');
    }
    
    // CSVパース
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      encoding: 'utf8'
    });
    
    console.log(`✅ CSV読み込み成功: ${filePath} (${records.length}件)`);
    return records;
    
  } catch (error) {
    console.error(`❌ CSV読み込みエラー: ${filePath}`, error);
    throw new Error(`Failed to load CSV file: ${filePath} - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * デフォルトCSV設定を読み込む
 * @returns CSVConfig オブジェクト
 */
export async function loadDefaultCSVConfig(): Promise<CSVConfig> {
  try {
    console.log('🔄 デフォルトCSV設定読み込み開始');
    
    // 各CSVファイルを並行読み込み
    const [basicRules, humanPatterns, qaKnowledge, successExamples] = await Promise.all([
      loadCSVFile(DEFAULT_CSV_PATHS.basicRules),
      loadCSVFile(DEFAULT_CSV_PATHS.humanPatterns),
      loadCSVFile(DEFAULT_CSV_PATHS.qaKnowledge),
      loadCSVFile(DEFAULT_CSV_PATHS.successExamples)
    ]);
    
    const csvConfig: CSVConfig = {
      basicRules,
      humanPatterns,
      qaKnowledge,
      successExamples
    };
    
    console.log('✅ デフォルトCSV設定読み込み完了:', {
      basicRulesCount: basicRules.length,
      humanPatternsCount: humanPatterns.length,
      qaKnowledgeCount: qaKnowledge.length,
      successExamplesCount: successExamples.length
    });
    
    return csvConfig;
    
  } catch (error) {
    console.error('❌ デフォルトCSV設定読み込みエラー:', error);
    throw new Error(`Failed to load default CSV configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * CSV設定のバリデーション
 * @param csvConfig CSV設定オブジェクト
 * @returns バリデーション結果
 */
export function validateCSVConfig(csvConfig: CSVConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 基本的な構造チェック
  if (!csvConfig.basicRules || !Array.isArray(csvConfig.basicRules) || csvConfig.basicRules.length === 0) {
    errors.push('basicRules is required and must be a non-empty array');
  }
  
  if (!csvConfig.humanPatterns || !Array.isArray(csvConfig.humanPatterns) || csvConfig.humanPatterns.length === 0) {
    errors.push('humanPatterns is required and must be a non-empty array');
  }
  
  if (!csvConfig.qaKnowledge || !Array.isArray(csvConfig.qaKnowledge) || csvConfig.qaKnowledge.length === 0) {
    errors.push('qaKnowledge is required and must be a non-empty array');
  }
  
  if (!csvConfig.successExamples || !Array.isArray(csvConfig.successExamples) || csvConfig.successExamples.length === 0) {
    errors.push('successExamples is required and must be a non-empty array');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * CSVファイルの存在確認
 * @returns 各CSVファイルの存在状況
 */
export function checkCSVFilesExistence(): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  
  Object.entries(DEFAULT_CSV_PATHS).forEach(([key, filePath]) => {
    const publicPath = path.join(process.cwd(), 'public', filePath);
    results[key] = fs.existsSync(publicPath);
  });
  
  console.log('📋 CSVファイル存在確認結果:', results);
  return results;
} 