/**
 * @file test-connection.ts
 * @description システム接続テスト用APIエンドポイント
 * 主な機能：データベース接続確認、環境変数確認、エージェント動作確認
 * 制限事項：開発環境でのみ使用、本番では無効化
 */
import type { NextApiRequest, NextApiResponse } from 'next';

interface TestResult {
  component: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

interface TestResponse {
  overall: 'success' | 'error' | 'warning';
  timestamp: string;
  results: TestResult[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<TestResponse>) {
  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      overall: 'error',
      timestamp: new Date().toISOString(),
      results: [{
        component: 'HTTP Method',
        status: 'error',
        message: 'Method not allowed. Use GET.',
      }],
    });
  }

  const results: TestResult[] = [];

  // 1. 環境変数チェック
  try {
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
    };

    const missingVars = Object.entries(envVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length === 0) {
      results.push({
        component: 'Environment Variables',
        status: 'success',
        message: 'All required environment variables are set',
        details: {
          supabaseUrl: envVars.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
          supabaseAnonKey: envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
          supabaseServiceKey: envVars.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
          anthropicApiKey: envVars.ANTHROPIC_API_KEY ? 'Set' : 'Missing',
          nodeEnv: envVars.NODE_ENV,
        },
      });
    } else {
      results.push({
        component: 'Environment Variables',
        status: 'warning',
        message: `Missing environment variables: ${missingVars.join(', ')}`,
        details: { missingVars },
      });
    }
  } catch (error) {
    results.push({
      component: 'Environment Variables',
      status: 'error',
      message: 'Failed to check environment variables',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 2. Supabaseクライアント接続テスト
  try {
    const { supabase, testConnection } = await import('../../config/supabase');
    
    const connectionResult = await testConnection();
    
    if (connectionResult) {
      results.push({
        component: 'Supabase Connection',
        status: 'success',
        message: 'Successfully connected to Supabase',
      });
    } else {
      results.push({
        component: 'Supabase Connection',
        status: 'error',
        message: 'Failed to connect to Supabase',
      });
    }
  } catch (error) {
    results.push({
      component: 'Supabase Connection',
      status: 'error',
      message: 'Supabase connection test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 3. エージェント初期化テスト
  try {
    const { CSVParserAgent } = await import('../../agents/CSVParserAgent');
    const { DynamicPromptBuilderAgent } = await import('../../agents/DynamicPromptBuilderAgent');
    const { QualityControllerAgent } = await import('../../agents/QualityControllerAgent');

    const csvParserAgent = new CSVParserAgent();
    const promptBuilderAgent = new DynamicPromptBuilderAgent();
    const qualityControllerAgent = new QualityControllerAgent();

    results.push({
      component: 'Mastraエージェントフレームワーク',
      status: 'success',
      message: 'All Mastra agents initialized successfully',
      details: {
        csvParserAgent: 'Mastra Agent Initialized',
        promptBuilderAgent: 'Mastra Agent Initialized',
        qualityControllerAgent: 'Mastra Agent Initialized',
      },
    });
  } catch (error) {
    results.push({
      component: 'CSV Review Agents',
      status: 'error',
      message: 'Failed to initialize agents',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 4. Claude API接続テスト（APIキーが設定されている場合のみ）
  if (process.env.ANTHROPIC_API_KEY && 
      process.env.ANTHROPIC_API_KEY !== 'your_claude_api_key_here' && 
      process.env.ANTHROPIC_API_KEY.startsWith('sk-')) {
    try {
      const { ReviewGeneratorAgent } = await import('../../agents/ReviewGeneratorAgent');
      const reviewGeneratorAgent = new ReviewGeneratorAgent(process.env.ANTHROPIC_API_KEY);

      // 簡単なテストプロンプトで接続確認
      // 実際のAPI呼び出しは行わず、初期化のみテスト
      results.push({
        component: 'Claude API',
        status: 'success',
        message: 'Claude API agent initialized (connection not tested)',
        details: {
          apiKeySet: true,
          agentInitialized: true,
        },
      });
    } catch (error) {
      results.push({
        component: 'Claude API',
        status: 'error',
        message: 'Failed to initialize Claude API agent',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    results.push({
      component: 'Claude API',
      status: 'warning',
      message: 'Claude API key not configured',
      details: {
        apiKeySet: false,
        reason: 'API key not set or using placeholder value',
      },
    });
  }

  // 5. ファイルシステムアクセステスト
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const sampleCsvPath = path.join(process.cwd(), 'sample-csv', 'basic_rules.csv');
    const fileExists = fs.existsSync(sampleCsvPath);
    
    if (fileExists) {
      results.push({
        component: 'File System',
        status: 'success',
        message: 'Sample CSV files accessible',
        details: {
          sampleCsvPath,
          fileExists: true,
        },
      });
    } else {
      results.push({
        component: 'File System',
        status: 'warning',
        message: 'Sample CSV files not found',
        details: {
          sampleCsvPath,
          fileExists: false,
        },
      });
    }
  } catch (error) {
    results.push({
      component: 'File System',
      status: 'error',
      message: 'File system access test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // 全体的なステータス判定
  const hasErrors = results.some(result => result.status === 'error');
  const hasWarnings = results.some(result => result.status === 'warning');
  
  const overall = hasErrors ? 'error' : hasWarnings ? 'warning' : 'success';

  const response: TestResponse = {
    overall,
    timestamp: new Date().toISOString(),
    results,
  };

  console.log('test-connection API: システムテスト完了', {
    overall,
    resultCount: results.length,
    errors: results.filter(r => r.status === 'error').length,
    warnings: results.filter(r => r.status === 'warning').length,
  });

  return res.status(200).json(response);
} 