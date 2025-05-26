/**
 * @file test-connection.js
 * @description Netlify Functions用システムテストAPIエンドポイント
 * Next.js APIルートをNetlify Functionsとして動作させるためのラッパー
 */

// Next.js APIハンドラーをインポート
const handler = require('../src/pages/api/test-connection.ts').default;

// Netlify Functions用のエクスポート
exports.handler = async (event, context) => {
  // Next.js APIリクエスト形式に変換
  const req = {
    method: event.httpMethod,
    body: event.body ? JSON.parse(event.body) : {},
    headers: event.headers,
    query: event.queryStringParameters || {},
  };

  // レスポンスオブジェクトのモック
  let statusCode = 200;
  let responseBody = '';
  let responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseBody = JSON.stringify(data);
      return res;
    },
    setHeader: (key, value) => {
      responseHeaders[key] = value;
      return res;
    },
    end: () => {
      return res;
    },
  };

  try {
    // Next.js APIハンドラーを実行
    await handler(req, res);

    return {
      statusCode,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (error) {
    console.error('Netlify Function Error:', error);
    
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        error: 'Internal Server Error',
        details: error.message,
      }),
    };
  }
}; 