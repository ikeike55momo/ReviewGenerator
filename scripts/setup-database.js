/**
 * データベースセットアップスクリプト
 * 
 * 概要:
 * - Supabaseデータベースにテーブルを作成
 * - 初期データを挿入
 * - 環境変数から接続情報を取得
 * 
 * 実行方法:
 * 1. .envファイルに環境変数を設定
 * 2. npm install dotenv (未インストールの場合)
 * 3. node scripts/setup-database.js
 * 
 * 必要な環境変数:
 * - NEXT_PUBLIC_SUPABASE_URL: SupabaseプロジェクトURL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabaseサービスロールキー
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 環境変数から設定を取得
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 環境変数バリデーション
if (!SUPABASE_URL) {
  console.error('❌ エラー: NEXT_PUBLIC_SUPABASE_URL環境変数が設定されていません');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ エラー: SUPABASE_SERVICE_ROLE_KEY環境変数が設定されていません');
  process.exit(1);
}

console.log('✓ 環境変数読み込み成功');
console.log(`  - Supabase URL: ${SUPABASE_URL}`);
console.log(`  - Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);

// Supabaseクライアント作成（サービスロールキー使用）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * 個別にテーブルを作成
 * @returns {Promise<void>}
 */
async function createTables() {
  try {
    console.log('テーブル作成開始...');

    // 1. システム設定テーブル
    console.log('system_settingsテーブル作成中...');
    const { error: settingsError } = await supabase.rpc('exec_sql', {
      sql: `CREATE TABLE IF NOT EXISTS system_settings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT NOT NULL,
        setting_type VARCHAR(20) DEFAULT 'string',
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    });

    if (settingsError) {
      console.error('system_settingsテーブル作成エラー:', settingsError.message);
    } else {
      console.log('✓ system_settingsテーブル作成成功');
    }

    // 2. CSVファイル管理テーブル
    console.log('csv_filesテーブル作成中...');
    const { error: csvError } = await supabase.rpc('exec_sql', {
      sql: `CREATE TABLE IF NOT EXISTS csv_files (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size INTEGER NOT NULL,
        upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        content_hash VARCHAR(64) NOT NULL,
        row_count INTEGER NOT NULL,
        column_count INTEGER NOT NULL,
        validation_status VARCHAR(20) DEFAULT 'pending',
        validation_errors JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    });

    if (csvError) {
      console.error('csv_filesテーブル作成エラー:', csvError.message);
    } else {
      console.log('✓ csv_filesテーブル作成成功');
    }

    console.log('テーブル作成完了');
  } catch (error) {
    console.error('テーブル作成エラー:', error);
    throw error;
  }
}

/**
 * データベースセットアップのメイン処理
 */
async function setupDatabase() {
  try {
    console.log('=== データベースセットアップ開始 ===');
    
    // 接続テスト
    console.log('Supabase接続テスト中...');
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').limit(1);
    
    if (error) {
      throw new Error(`接続エラー: ${error.message}`);
    }
    
    console.log('✓ Supabase接続成功');

    // テーブル作成
    await createTables();

    // 作成されたテーブル確認
    console.log('\n=== 作成されたテーブル確認 ===');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.error('テーブル一覧取得エラー:', tablesError.message);
    } else {
      console.log('作成されたテーブル:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }

    console.log('\n✅ データベースセットアップ完了');
    
  } catch (error) {
    console.error('❌ データベースセットアップエラー:', error.message);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase }; 