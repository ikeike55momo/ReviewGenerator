/**
 * @file CSVUploader.tsx
 * @description CSVアップロード・プレビュー・バリデーションコンポーネント（shadcn/ui対応）
 * 主な機能：4つのCSVファイルの個別アップロード、即時プレビュー、スキーマバリデーション
 * 制限事項：ドラッグ&ドロップ対応、エラーメッセージ日本語表示、型安全
 */
import React, { useState, useCallback } from 'react';
import { parse } from 'csv-parse/sync';
import { CSVConfig, BasicRule, HumanPattern, QAKnowledge, SuccessExample } from '../types/csv';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import ErrorBoundary from './ErrorBoundary';

interface CSVUploaderProps {
  onUploadComplete: (config: CSVConfig) => void;
}

interface FileUploadState {
  file: File | null;
  data: any[] | null;
  error: string | null;
  isValid: boolean;
}

const CSV_TYPES = {
  basicRules: {
    label: 'Basic Rules CSV',
    description: 'カテゴリ、タイプ、コンテンツを含む基本ルール',
    expectedHeaders: ['category', 'type', 'content'],
  },
  humanPatterns: {
    label: 'Human Patterns CSV',
    description: '年齢層、性格タイプ、性別、語彙パターン',
    expectedHeaders: ['age_group', 'personality_type', 'vocabulary', 'exclamation_marks', 'characteristics', 'example'],
  },
  qaKnowledge: {
    label: 'QA Knowledge CSV',
    description: '質問、回答、カテゴリ、優先度、例文',
    expectedHeaders: ['question', 'answer', 'category', 'priority', 'example_situation', 'example_before', 'example_after'],
  },
  successExamples: {
    label: 'Success Examples CSV',
    description: 'レビュー例、年齢、性別、同伴者、推奨度',
    expectedHeaders: ['review', 'age', 'gender', 'companion', 'word', 'recommend'],
  },
} as const;

export const CSVUploader: React.FC<CSVUploaderProps> = ({ onUploadComplete }) => {
  const [uploadStates, setUploadStates] = useState<Record<keyof typeof CSV_TYPES, FileUploadState>>({
    basicRules: { file: null, data: null, error: null, isValid: false },
    humanPatterns: { file: null, data: null, error: null, isValid: false },
    qaKnowledge: { file: null, data: null, error: null, isValid: false },
    successExamples: { file: null, data: null, error: null, isValid: false },
  });

  /**
   * CSVファイルのバリデーション
   * @param data パース済みCSVデータ
   * @param expectedHeaders 期待されるヘッダー
   * @returns バリデーション結果
   */
  const validateCSV = (data: any[], expectedHeaders: readonly string[]): { isValid: boolean; error: string | null } => {
    if (!data || data.length === 0) {
      return { isValid: false, error: 'CSVファイルが空です' };
    }

    const headers = Object.keys(data[0]);
    const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));

    if (missingHeaders.length > 0) {
      return {
        isValid: false,
        error: `必須ヘッダーが不足しています: ${missingHeaders.join(', ')}`,
      };
    }

    return { isValid: true, error: null };
  };

  /**
   * ファイルアップロード処理
   * @param file アップロードされたファイル
   * @param csvType CSVタイプ
   */
  const handleFileUpload = useCallback(async (file: File, csvType: keyof typeof CSV_TYPES) => {
    try {
      let text = await file.text();
      
      // BOM（Byte Order Mark）を除去
      if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
        console.log(`BOM除去: ${file.name}`);
      }
      
      // デバッグ情報出力
      const lines = text.split('\n').slice(0, 3); // 最初の3行のみ
      const headerLine = lines[0] || '';
      const headerColumns = headerLine.split(',').map(col => col.trim());
      
      console.log(`CSVデバッグ情報 - ${file.name}:`, {
        fileSize: file.size,
        lineCount: text.split('\n').length,
        rawHeaderLine: headerLine,
        headerColumns: headerColumns,
        headerColumnsLength: headerColumns.length,
        expectedHeaders: CSV_TYPES[csvType].expectedHeaders,
        firstThreeLines: lines.map((line, index) => ({
          lineNumber: index + 1,
          content: line,
          columnCount: line.split(',').length
        }))
      });
      
      const data = parse(text, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true, // 列数の不一致を許可
        trim: true, // 前後の空白を削除
        encoding: 'utf8',
      });

      const { isValid, error } = validateCSV(data, CSV_TYPES[csvType].expectedHeaders);

      setUploadStates(prev => ({
        ...prev,
        [csvType]: {
          file,
          data: isValid ? data : null,
          error,
          isValid,
        },
      }));

      // 全てのCSVが有効な場合、親コンポーネントに通知
      const newStates = { ...uploadStates, [csvType]: { file, data: isValid ? data : null, error, isValid } };
      const allValid = Object.values(newStates).every(state => state.isValid);

      if (allValid) {
        const config: CSVConfig = {
          basicRules: newStates.basicRules.data as BasicRule[],
          humanPatterns: newStates.humanPatterns.data as HumanPattern[],
          qaKnowledge: newStates.qaKnowledge.data as QAKnowledge[],
          successExamples: newStates.successExamples.data as SuccessExample[],
        };
        onUploadComplete(config);
      }
    } catch (error) {
      console.error(`CSVUploader: ${csvType}のパースエラー`, error);
      
      // より詳細なエラーメッセージを作成
      let detailedMessage = `CSVパースエラー: ${error instanceof Error ? error.message : '不明なエラー'}`;
      
      if (error instanceof Error && error.message.includes('Invalid Record Length')) {
        detailedMessage += '\n\n解決方法:\n1. CSVファイルの列数を確認してください\n2. 余分なカンマや改行がないか確認してください\n3. 文字エンコーディングがUTF-8であることを確認してください';
      }
      
      setUploadStates(prev => ({
        ...prev,
        [csvType]: {
          file,
          data: null,
          error: detailedMessage,
          isValid: false,
        },
      }));
    }
  }, [uploadStates, onUploadComplete]);

  /**
   * ドラッグ&ドロップハンドラー
   */
  const handleDrop = useCallback((e: React.DragEvent, csvType: keyof typeof CSV_TYPES) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));

    if (csvFile) {
      handleFileUpload(csvFile, csvType);
    } else {
      alert('CSVファイルを選択してください');
    }
  }, [handleFileUpload]);

  /**
   * ファイル選択ハンドラー
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, csvType: keyof typeof CSV_TYPES) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, csvType);
    }
  }, [handleFileUpload]);

  return (
    <ErrorBoundary>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(CSV_TYPES).map(([csvType, config]) => {
          const state = uploadStates[csvType as keyof typeof CSV_TYPES];
          
          return (
            <Card key={csvType}>
              <CardHeader>
                <CardTitle className="text-lg">{config.label}</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* アップロードエリア */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    state.isValid
                      ? 'border-green-300 bg-green-50'
                      : state.error
                      ? 'border-destructive bg-destructive/5'
                      : 'border-muted-foreground/25 bg-muted/50 hover:border-primary'
                  }`}
                  onDrop={(e) => handleDrop(e, csvType as keyof typeof CSV_TYPES)}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {state.file ? (
                    <div>
                      <p className="text-sm font-medium">{state.file.name}</p>
                      {state.isValid && (
                        <p className="text-sm text-green-600 mt-1">✓ バリデーション成功</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground">CSVファイルをドラッグ&ドロップ</p>
                      <p className="text-xs text-muted-foreground mt-1">または</p>
                    </div>
                  )}

                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => handleFileSelect(e, csvType as keyof typeof CSV_TYPES)}
                    className="hidden"
                    id={`file-input-${csvType}`}
                  />
                  <Button asChild className="mt-2">
                    <label htmlFor={`file-input-${csvType}`} className="cursor-pointer">
                      ファイルを選択
                    </label>
                  </Button>
                </div>

                {/* エラーメッセージ */}
                {state.error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {state.error}
                    </AlertDescription>
                  </Alert>
                )}

                {/* プレビュー */}
                {state.data && state.data.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">プレビュー（最大5件）</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border border-border rounded-md">
                        <thead className="bg-muted">
                          <tr>
                            {Object.keys(state.data[0]).map(header => (
                              <th key={header} className="px-2 py-1 text-left border-b border-border">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {state.data.slice(0, 5).map((row, index) => (
                            <tr key={index} className="border-b border-border">
                              {Object.values(row).map((cell, cellIndex) => (
                                <td key={cellIndex} className="px-2 py-1 border-r border-border">
                                  {String(cell).substring(0, 50)}
                                  {String(cell).length > 50 && '...'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      総件数: {state.data.length}件
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ErrorBoundary>
  );
}; 