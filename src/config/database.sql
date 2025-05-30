-- CSV駆動型レビュー生成システム用データベーススキーマ
-- 作成日: 2024年1月
-- 説明: レビュー生成、CSV管理、品質管理用のテーブル定義

-- 1. CSVファイル管理テーブル
CREATE TABLE IF NOT EXISTS csv_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('basic_rules', 'human_patterns', 'qa_knowledge', 'success_examples')),
    file_size INTEGER NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content_hash VARCHAR(64) NOT NULL,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,
    validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'valid', 'invalid')),
    validation_errors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 生成されたレビューテーブル
CREATE TABLE IF NOT EXISTS generated_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_text TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    reviewer_age INTEGER CHECK (reviewer_age >= 10 AND reviewer_age <= 100),
    reviewer_gender VARCHAR(10) CHECK (reviewer_gender IN ('male', 'female', 'other')),
    quality_score DECIMAL(3,2) CHECK (quality_score >= 0 AND quality_score <= 1),
    generation_prompt TEXT,
    generation_parameters JSONB,
    csv_file_ids UUID[] NOT NULL,
    generation_batch_id UUID,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 生成バッチ管理テーブル
CREATE TABLE IF NOT EXISTS generation_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_name VARCHAR(255),
    total_count INTEGER NOT NULL,
    completed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    generation_parameters JSONB NOT NULL,
    csv_file_ids UUID[] NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. プロンプトテンプレート管理テーブル
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL UNIQUE,
    template_content TEXT NOT NULL,
    template_version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    parameters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 品質管理ログテーブル
CREATE TABLE IF NOT EXISTS quality_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES generated_reviews(id) ON DELETE CASCADE,
    quality_check_type VARCHAR(50) NOT NULL,
    score DECIMAL(3,2) NOT NULL,
    details JSONB,
    passed BOOLEAN NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. システム設定テーブル
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_csv_files_type ON csv_files(file_type);
CREATE INDEX IF NOT EXISTS idx_csv_files_upload_date ON csv_files(upload_date);
CREATE INDEX IF NOT EXISTS idx_generated_reviews_batch_id ON generated_reviews(generation_batch_id);
CREATE INDEX IF NOT EXISTS idx_generated_reviews_quality_score ON generated_reviews(quality_score);
CREATE INDEX IF NOT EXISTS idx_generated_reviews_created_at ON generated_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_generation_batches_status ON generation_batches(status);
CREATE INDEX IF NOT EXISTS idx_quality_logs_review_id ON quality_logs(review_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);

-- 更新日時自動更新用トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 各テーブルに更新日時トリガーを設定
CREATE TRIGGER update_csv_files_updated_at BEFORE UPDATE ON csv_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_generated_reviews_updated_at BEFORE UPDATE ON generated_reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_generation_batches_updated_at BEFORE UPDATE ON generation_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 初期データ挿入
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
('max_reviews_per_batch', '100', 'number', '一度に生成可能な最大レビュー数', true),
('min_quality_score', '0.7', 'number', '承認に必要な最小品質スコア', true),
('default_generation_timeout', '300', 'number', 'レビュー生成のタイムアウト時間（秒）', false),
('claude_model', 'claude-sonnet-4-20250514', 'string', '使用するClaudeモデル', false),
('enable_quality_filter', 'true', 'boolean', '品質フィルターの有効化', true);

-- デフォルトプロンプトテンプレート
INSERT INTO prompt_templates (template_name, template_content, description, is_active) VALUES
('default_review_prompt', 
'あなたは商品レビューを書く専門家です。以下の情報を基に、自然で説得力のある日本語レビューを生成してください。

基本ルール:
{basic_rules}

人間らしいパターン:
{human_patterns}

Q&A知識:
{qa_knowledge}

成功例:
{success_examples}

生成条件:
- 評価: {rating}点
- レビュアー年齢: {age}歳
- レビュアー性別: {gender}
- 文字数: 100-300文字

自然で人間らしい、具体的で説得力のあるレビューを生成してください。',
'デフォルトのレビュー生成プロンプト',
true);

COMMENT ON TABLE csv_files IS 'アップロードされたCSVファイルの管理';
COMMENT ON TABLE generated_reviews IS '生成されたレビューデータの保存';
COMMENT ON TABLE generation_batches IS 'レビュー生成バッチの管理';
COMMENT ON TABLE prompt_templates IS 'プロンプトテンプレートの管理';
COMMENT ON TABLE quality_logs IS '品質チェックログの記録';
COMMENT ON TABLE system_settings IS 'システム設定の管理'; 