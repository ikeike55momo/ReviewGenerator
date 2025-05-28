/**
 * @file api-test-suite.ts
 * @description API動作確認用テストスイート
 * 主な機能：各APIエンドポイントの動作確認、エラーハンドリングテスト
 * 制限事項：開発環境でのみ使用
 */

interface APITestResult {
  endpoint: string;
  method: string;
  status: 'success' | 'error' | 'warning';
  responseTime: number;
  statusCode?: number;
  error?: string;
  data?: any;
}

interface TestSuiteResult {
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: APITestResult[];
  timestamp: string;
}

/**
 * APIエンドポイントテスト実行
 */
export class APITestSuite {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * 単一エンドポイントのテスト
   */
  private async testEndpoint(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<APITestResult> {
    const startTime = Date.now();
    
    try {
      const url = `${this.baseUrl}/api/${endpoint}`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseTime = Date.now() - startTime;
      
      // レスポンスボディを取得
      let data;
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }

      return {
        endpoint,
        method,
        status: response.ok ? 'success' : 'error',
        responseTime,
        statusCode: response.status,
        data: typeof data === 'string' ? { message: data } : data,
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        endpoint,
        method,
        status: 'error',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 全エンドポイントのテスト実行
   */
  async runAllTests(): Promise<TestSuiteResult> {
    console.log('🧪 API動作確認テスト開始...');
    
    const testCases = [
      // 基本接続テスト
      { endpoint: 'test-simple', method: 'GET' as const },
      { endpoint: 'test-connection', method: 'GET' as const },
      
      // レビュー生成API（軽量版）
      { endpoint: 'generate-reviews-simple', method: 'POST' as const, body: {
        csvConfig: {
          basicRules: [],
          humanPatterns: [],
          qaKnowledge: [],
          successExamples: []
        },
        reviewCount: 1,
        customPrompt: 'テスト用プロンプト'
      }},
      
      // その他のAPI
      { endpoint: 'generate-reviews-lite', method: 'POST' as const, body: {
        csvConfig: {
          basicRules: [],
          humanPatterns: [],
          qaKnowledge: [],
          successExamples: []
        },
        reviewCount: 1
      }},
      
      // バッチ関連API
      { endpoint: 'batch-history', method: 'GET' as const },
    ];

    const results: APITestResult[] = [];
    
    for (const testCase of testCases) {
      console.log(`  テスト中: ${testCase.endpoint}`);
      const result = await this.testEndpoint(
        testCase.endpoint,
        testCase.method,
        testCase.body
      );
      results.push(result);
      
      // APIへの負荷を避けるため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 結果集計
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      warnings: results.filter(r => r.status === 'warning').length,
    };

    const testResult: TestSuiteResult = {
      summary,
      results,
      timestamp: new Date().toISOString(),
    };

    console.log('🧪 API動作確認テスト完了:', summary);
    
    return testResult;
  }

  /**
   * テスト結果の詳細表示
   */
  static logDetailedResults(results: TestSuiteResult) {
    console.group('📋 API動作確認テスト詳細結果');
    
    console.log(`📊 概要:`, results.summary);
    console.log(`🕐 実行時刻: ${results.timestamp}`);
    
    console.group('📝 個別結果:');
    results.results.forEach((result, index) => {
      const icon = result.status === 'success' ? '✅' : 
                   result.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${icon} ${index + 1}. ${result.method} /api/${result.endpoint}`);
      console.log(`   ステータス: ${result.status}`);
      console.log(`   レスポンス時間: ${result.responseTime}ms`);
      
      if (result.statusCode) {
        console.log(`   HTTPステータス: ${result.statusCode}`);
      }
      
      if (result.error) {
        console.log(`   エラー: ${result.error}`);
      }
      
      if (result.data && result.status === 'success') {
        console.log(`   データ確認: OK`);
      }
      
      console.log('');
    });
    console.groupEnd();
    
    console.groupEnd();
  }
}

/**
 * ブラウザ環境でのAPIテスト実行
 */
export const runAPITests = async (baseUrl?: string): Promise<TestSuiteResult> => {
  const testSuite = new APITestSuite(baseUrl);
  const results = await testSuite.runAllTests();
  
  APITestSuite.logDetailedResults(results);
  
  return results;
};

export default APITestSuite;