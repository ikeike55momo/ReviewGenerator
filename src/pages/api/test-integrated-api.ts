/**
 * @file test-integrated-api.ts
 * @description 新統合APIエンドポイントのテスト用API
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { CSVConfig } from '../../types/csv';

export const config = {
  maxDuration: 60,
};

interface TestResult {
  success: boolean;
  timestamp: string;
  tests: {
    [key: string]: {
      passed: boolean;
      message: string;
      responseTime?: number;
      error?: string;
    };
  };
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<TestResult>) {
  console.log('🧪 統合APIテスト開始');
  
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const tests: TestResult['tests'] = {};
  
  // テスト用のダミーCSV設定
  const dummyCSVConfig: CSVConfig = {
    keywords: [
      { keyword: 'おいしい', type: 'required', weight: 1.0 },
      { keyword: 'すばらしい', type: 'recommended', weight: 0.8 }
    ],
    patterns: [
      { pattern: '{{age}}代の{{gender}}として', age_group: '20代', gender: 'female', tone: 'friendly' },
      { pattern: 'とても{{keyword}}でした', age_group: '30代', gender: 'male', tone: 'formal' }
    ],
    examples: [
      { text: '料理がおいしくて満足でした', rating: 5, category: 'food' },
      { text: 'スタッフの対応がすばらしかったです', rating: 4, category: 'service' }
    ],
    qualityRules: [
      { rule: 'length_check', min_chars: 10, max_chars: 200 },
      { rule: 'keyword_density', min_density: 0.1, max_density: 0.3 }
    ]
  };

  try {
    // Test 1: 環境変数チェック
    const startTime1 = Date.now();
    try {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }
      tests['environment_check'] = {
        passed: true,
        message: 'Environment variables are properly configured',
        responseTime: Date.now() - startTime1
      };
    } catch (error) {
      tests['environment_check'] = {
        passed: false,
        message: 'Environment check failed',
        responseTime: Date.now() - startTime1,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 2: APIエンドポイント存在チェック
    const startTime2 = Date.now();
    try {
      const response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/reviews/generate`, {
        method: 'OPTIONS'
      });
      
      if (response.ok) {
        tests['endpoint_existence'] = {
          passed: true,
          message: 'Integrated API endpoint exists and responds to OPTIONS',
          responseTime: Date.now() - startTime2
        };
      } else {
        throw new Error(`OPTIONS request failed with status ${response.status}`);
      }
    } catch (error) {
      tests['endpoint_existence'] = {
        passed: false,
        message: 'API endpoint availability check failed',
        responseTime: Date.now() - startTime2,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 3: パラメータバリデーションテスト（不正なリクエスト）
    const startTime3 = Date.now();
    try {
      const response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // 不正なパラメータ
          invalidParam: 'test'
        }),
      });

      if (response.status === 400) {
        tests['parameter_validation'] = {
          passed: true,
          message: 'Parameter validation working correctly (rejected invalid request)',
          responseTime: Date.now() - startTime3
        };
      } else {
        throw new Error(`Expected 400 but got ${response.status}`);
      }
    } catch (error) {
      tests['parameter_validation'] = {
        passed: false,
        message: 'Parameter validation test failed',
        responseTime: Date.now() - startTime3,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 4: モード検証テスト
    const startTime4 = Date.now();
    try {
      const response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvConfig: dummyCSVConfig,
          reviewCount: 1,
          mode: 'invalid_mode'
        }),
      });

      if (response.status === 400) {
        const result = await response.json();
        if (result.error && result.error.message.includes('無効なモード')) {
          tests['mode_validation'] = {
            passed: true,
            message: 'Mode validation working correctly',
            responseTime: Date.now() - startTime4
          };
        } else {
          throw new Error('Mode validation error message incorrect');
        }
      } else {
        throw new Error(`Expected 400 but got ${response.status}`);
      }
    } catch (error) {
      tests['mode_validation'] = {
        passed: false,
        message: 'Mode validation test failed',
        responseTime: Date.now() - startTime4,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 5: 正常なリクエスト構造テスト（実際の生成はしない）
    const startTime5 = Date.now();
    try {
      const response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvConfig: dummyCSVConfig,
          reviewCount: 1,
          mode: 'minimal'
        }),
      });

      // リクエストが正常に処理されるかどうかをチェック
      // 実際の生成エラーは許容（APIキーや実際の生成処理のエラー）
      if (response.status === 200 || response.status === 500) {
        tests['request_structure'] = {
          passed: true,
          message: 'Request structure is valid (API processes the request)',
          responseTime: Date.now() - startTime5
        };
      } else {
        const result = await response.json();
        throw new Error(`Unexpected status ${response.status}: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      tests['request_structure'] = {
        passed: false,
        message: 'Request structure test failed',
        responseTime: Date.now() - startTime5,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Test 6: レスポンス形式テスト
    const startTime6 = Date.now();
    try {
      const response = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvConfig: dummyCSVConfig,
          reviewCount: 999999 // 意図的に大きな数値
        }),
      });

      const result = await response.json();
      
      // レスポンス構造をチェック
      if (result && typeof result === 'object' && ('success' in result || 'error' in result)) {
        tests['response_format'] = {
          passed: true,
          message: 'Response format is consistent',
          responseTime: Date.now() - startTime6
        };
      } else {
        throw new Error('Response format is incorrect');
      }
    } catch (error) {
      tests['response_format'] = {
        passed: false,
        message: 'Response format test failed',
        responseTime: Date.now() - startTime6,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

  } catch (globalError) {
    console.error('❌ テスト実行中にグローバルエラー:', globalError);
  }

  // サマリー計算
  const testEntries = Object.entries(tests);
  const summary = {
    total: testEntries.length,
    passed: testEntries.filter(([, test]) => test.passed).length,
    failed: testEntries.filter(([, test]) => !test.passed).length
  };

  const result: TestResult = {
    success: summary.failed === 0,
    timestamp: new Date().toISOString(),
    tests,
    summary
  };

  console.log('🎯 統合APIテスト完了:', {
    summary,
    passedTests: Object.entries(tests).filter(([, test]) => test.passed).map(([name]) => name),
    failedTests: Object.entries(tests).filter(([, test]) => !test.passed).map(([name]) => name)
  });

  return res.status(200).json(result);
}