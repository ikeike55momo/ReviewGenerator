/**
 * @file debug-test.ts
 * @description デバッグ用テストAPIエンドポイント
 */
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('🧪 Debug Test API 呼び出し:', {
    method: req.method,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body
  });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    success: true,
    message: 'Debug Test API is working!',
    timestamp: new Date().toISOString(),
    method: req.method,
    receivedData: req.body || null
  });
} 