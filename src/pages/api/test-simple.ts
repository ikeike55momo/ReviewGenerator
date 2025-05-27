/**
 * @file test-simple.ts
 * @description Netlify環境での動作確認用シンプルAPIエンドポイント
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🧪 シンプルテストAPI呼び出し:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    headers: Object.keys(req.headers),
    url: req.url
  });

  // CORSヘッダー設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONSリクエスト処理完了');
    return res.status(200).end();
  }

  try {
    // 環境変数チェック
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    // 簡単なfetchテスト
    const testResponse = await fetch('https://httpbin.org/json', {
      method: 'GET',
      headers: {
        'User-Agent': 'Netlify-Test'
      }
    });
    
    const testData = await testResponse.json();
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        hasAnthropicKey: !!anthropicKey,
        anthropicKeyLength: anthropicKey?.length || 0
      },
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent']
      },
      fetchTest: {
        status: testResponse.status,
        data: testData
      },
      message: 'Netlify環境でのNext.js APIルートが正常に動作しています'
    };

    console.log('✅ シンプルテスト成功:', result);
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ シンプルテストエラー:', error);
    
    const errorResult = {
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    return res.status(500).json(errorResult);
  }
} 