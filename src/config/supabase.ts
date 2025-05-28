/**
 * Supabaseクライアント設定（コネクションプール統合版）
 * 
 * 概要:
 * - Supabaseデータベースへの接続設定
 * - コネクションプール統合
 * - 環境変数からの設定読み込み
 * - TypeScript型定義
 * 
 * 主な機能:
 * - Supabaseクライアントインスタンス作成
 * - コネクションプール管理
 * - 環境変数バリデーション
 * - エラーハンドリング
 * 
 * 制限事項:
 * - 環境変数が設定されていない場合はエラー
 * - サーバーサイドでは最適化されたプールを使用
 */

import { createClient } from '@supabase/supabase-js';
import { getConnectionPool, getPoolStats } from './database-pool';

// 環境変数の型定義
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/**
 * 環境変数からSupabase設定を取得
 * @returns {SupabaseConfig} Supabase設定オブジェクト
 * @throws {Error} 必要な環境変数が設定されていない場合
 */
const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL環境変数が設定されていません');
  }

  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY環境変数が設定されていません');
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
};

// Supabase設定を取得
const config = getSupabaseConfig();

/**
 * Supabaseクライアント（匿名キー使用）
 * フロントエンド用の一般的なクライアント
 */
export const supabase = createClient(config.url, config.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'csv-review-generator',
    },
  },
});

/**
 * Supabaseクライアント（サービスロールキー使用）
 * サーバーサイド用の管理者権限クライアント
 * 注意: フロントエンドでは使用しないこと
 */
export const supabaseAdmin = config.serviceRoleKey
  ? createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    })
  : null;

/**
 * データベース接続テスト（コネクションプール使用）
 * @returns {Promise<boolean>} 接続成功時はtrue
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    // サーバーサイドの場合はコネクションプールを使用
    if (typeof window === 'undefined') {
      const pool = getConnectionPool();
      const result = await pool.executeWithRetry(async (client) => {
        const { data, error } = await client
          .from('system_settings')
          .select('setting_key')
          .limit(1);
        
        if (error) {
          throw new Error(error.message);
        }
        
        return data;
      });
      
      console.log('Supabase接続成功（プール使用）');
      return true;
    } else {
      // クライアントサイドは従来通り
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key')
        .limit(1);

      if (error) {
        console.error('Supabase接続エラー:', error.message);
        return false;
      }

      console.log('Supabase接続成功');
      return true;
    }
  } catch (error) {
    console.error('Supabase接続テストエラー:', error);
    return false;
  }
};

/**
 * コネクションプール統計情報の取得
 * @returns {Promise<object>} プール統計情報
 */
export const getConnectionStats = async () => {
  if (typeof window === 'undefined') {
    return getPoolStats();
  }
  return null;
};

/**
 * データベーステーブル名の定数
 */
export const TABLES = {
  CSV_FILES: 'csv_files',
  GENERATED_REVIEWS: 'generated_reviews',
  GENERATION_BATCHES: 'generation_batches',
  PROMPT_TEMPLATES: 'prompt_templates',
  QUALITY_LOGS: 'quality_logs',
  SYSTEM_SETTINGS: 'system_settings',
} as const;

/**
 * データベース型定義
 */
export interface Database {
  public: {
    Tables: {
      csv_files: {
        Row: {
          id: string;
          file_name: string;
          file_type: 'basic_rules' | 'human_patterns' | 'qa_knowledge' | 'success_examples';
          file_size: number;
          upload_date: string;
          content_hash: string;
          row_count: number;
          column_count: number;
          validation_status: 'pending' | 'valid' | 'invalid';
          validation_errors: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          file_type: 'basic_rules' | 'human_patterns' | 'qa_knowledge' | 'success_examples';
          file_size: number;
          upload_date?: string;
          content_hash: string;
          row_count: number;
          column_count: number;
          validation_status?: 'pending' | 'valid' | 'invalid';
          validation_errors?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          file_name?: string;
          file_type?: 'basic_rules' | 'human_patterns' | 'qa_knowledge' | 'success_examples';
          file_size?: number;
          upload_date?: string;
          content_hash?: string;
          row_count?: number;
          column_count?: number;
          validation_status?: 'pending' | 'valid' | 'invalid';
          validation_errors?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      generated_reviews: {
        Row: {
          id: string;
          review_text: string;
          rating: number;
          reviewer_age: number;
          reviewer_gender: 'male' | 'female' | 'other';
          quality_score: number;
          generation_prompt: string;
          generation_parameters: any;
          csv_file_ids: string[];
          generation_batch_id: string;
          is_approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          review_text: string;
          rating: number;
          reviewer_age?: number;
          reviewer_gender?: 'male' | 'female' | 'other';
          quality_score?: number;
          generation_prompt?: string;
          generation_parameters?: any;
          csv_file_ids: string[];
          generation_batch_id?: string;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          review_text?: string;
          rating?: number;
          reviewer_age?: number;
          reviewer_gender?: 'male' | 'female' | 'other';
          quality_score?: number;
          generation_prompt?: string;
          generation_parameters?: any;
          csv_file_ids?: string[];
          generation_batch_id?: string;
          is_approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      generation_batches: {
        Row: {
          id: string;
          batch_name: string;
          total_count: number;
          completed_count: number;
          failed_count: number;
          status: 'pending' | 'processing' | 'completed' | 'failed';
          generation_parameters: any;
          csv_file_ids: string[];
          start_time: string;
          end_time: string;
          error_message: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_name?: string;
          total_count: number;
          completed_count?: number;
          failed_count?: number;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          generation_parameters: any;
          csv_file_ids: string[];
          start_time?: string;
          end_time?: string;
          error_message?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          batch_name?: string;
          total_count?: number;
          completed_count?: number;
          failed_count?: number;
          status?: 'pending' | 'processing' | 'completed' | 'failed';
          generation_parameters?: any;
          csv_file_ids?: string[];
          start_time?: string;
          end_time?: string;
          error_message?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      prompt_templates: {
        Row: {
          id: string;
          template_name: string;
          template_content: string;
          template_version: string;
          is_active: boolean;
          description: string;
          parameters: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_name: string;
          template_content: string;
          template_version?: string;
          is_active?: boolean;
          description?: string;
          parameters?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_name?: string;
          template_content?: string;
          template_version?: string;
          is_active?: boolean;
          description?: string;
          parameters?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      quality_logs: {
        Row: {
          id: string;
          review_id: string;
          quality_check_type: string;
          score: number;
          details: any;
          passed: boolean;
          checked_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          quality_check_type: string;
          score: number;
          details?: any;
          passed: boolean;
          checked_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          quality_check_type?: string;
          score?: number;
          details?: any;
          passed?: boolean;
          checked_at?: string;
        };
      };
      system_settings: {
        Row: {
          id: string;
          setting_key: string;
          setting_value: string;
          setting_type: 'string' | 'number' | 'boolean' | 'json';
          description: string;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          setting_key: string;
          setting_value: string;
          setting_type?: 'string' | 'number' | 'boolean' | 'json';
          description?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          setting_key?: string;
          setting_value?: string;
          setting_type?: 'string' | 'number' | 'boolean' | 'json';
          description?: string;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
} 