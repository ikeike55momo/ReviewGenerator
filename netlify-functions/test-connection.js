/**
 * @file test-connection.js
 * @description Netlify Functions用システムテストAPIエンドポイント
 * 純粋JavaScript実装でTypeScript依存関係を回避
 */

// Netlify Functions用のエクスポート
exports.handler = async (event, context) => {
  // CORSヘッダー設定
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONSリクエスト（プリフライト）の処理
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const testResults = [];
    let overallStatus = 'success';

    // 環境変数テスト
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    testResults.push({
      component: '環境変数',
      status: (anthropicApiKey && supabaseUrl && supabaseAnonKey) ? 'success' : 'error',
      message: (anthropicApiKey && supabaseUrl && supabaseAnonKey) 
        ? '全ての環境変数が設定されています' 
        : '一部の環境変数が不足しています',
      details: {
        ANTHROPIC_API_KEY: !!anthropicApiKey,
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_ANON_KEY: !!supabaseAnonKey,
      }
    });

    if (!anthropicApiKey || !supabaseUrl || !supabaseAnonKey) {
      overallStatus = 'error';
    }

    // Anthropic APIテスト（簡易版）
    if (anthropicApiKey) {
      testResults.push({
        component: 'Anthropic API',
        status: 'success',
        message: 'Claude APIキーが設定されています（デバッグモード）',
        details: { 
          api_key_length: anthropicApiKey.length,
          api_key_prefix: anthropicApiKey.substring(0, 10) + '...'
        }
      });
    } else {
      testResults.push({
        component: 'Anthropic API',
        status: 'error',
        message: 'Claude APIキーが設定されていません',
        details: { api_key_present: false }
      });
      overallStatus = 'error';
    }

    // Supabaseテスト（簡易版）
    if (supabaseUrl && supabaseAnonKey) {
      testResults.push({
        component: 'Supabase設定',
        status: 'success',
        message: 'Supabase設定が確認されました',
        details: { url: supabaseUrl.substring(0, 30) + '...' }
      });
    }

    // システム情報
    testResults.push({
      component: 'システム情報',
      status: 'success',
      message: 'Netlify Functions環境で動作中',
      details: {
        node_version: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      }
    });

    const response = {
      overall: overallStatus,
      timestamp: new Date().toISOString(),
      results: testResults,
      system: 'Netlify Functions',
      framework: 'Pure JavaScript'
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };

  } catch (error) {
    console.error('System Test Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        overall: 'error',
        timestamp: new Date().toISOString(),
        results: [{
          component: 'System Test',
          status: 'error',
          message: `システムテストエラー: ${error.message}`,
          details: { error: error.message }
        }]
      }),
    };
  }
}; 