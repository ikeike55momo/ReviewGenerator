const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class ClaudeCodeBuilder {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.isGitHubActions = process.env.GITHUB_ACTIONS === 'true';
  }

  // requirements フォルダ内の全ファイルを読み込み
  async loadRequirements() {
    const requirementsDir = './requirements';
    let allRequirements = '';

    try {
      const files = await fs.readdir(requirementsDir);
      
      for (const file of files) {
        if (path.extname(file) === '.md' || path.extname(file) === '.mdc') {
          const filePath = path.join(requirementsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          allRequirements += `\n\n### ${file}\n${content}`;
        }
      }
      
      return allRequirements;
    } catch (error) {
      console.error('Requirements フォルダの読み込みエラー:', error);
      return '';
    }
  }

  // sample-csv フォルダ内の全ファイルを読み込み
  async loadSampleCSVs() {
    const csvDir = './sample-csv';
    let allCSVs = '';

    try {
      const files = await fs.readdir(csvDir);
      
      for (const file of files) {
        if (path.extname(file) === '.csv') {
          const filePath = path.join(csvDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          allCSVs += `\n\n### ${file}\n\`\`\`csv\n${content}\n\`\`\``;
        }
      }
      
      return allCSVs;
    } catch (error) {
      console.error('Sample CSV フォルダの読み込みエラー:', error);
      return '';
    }
  }

  async buildProject(phase = 1) {
    const requirements = await this.loadRequirements();
    const sampleCSVs = await this.loadSampleCSVs();
    const prompt = this.buildPrompt(requirements, sampleCSVs, phase);
    
    try {
      if (this.isGitHubActions) {
        console.log('::group::Claude Code API Response');
      }
      
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const result = response.content[0].text;
      
      if (this.isGitHubActions) {
        console.log('::endgroup::');
        
        // GitHub Actionsでファイル自動生成
        await this.createFilesFromResponse(result);
      } else {
        console.log('\n🤖 Claude からの回答:\n');
        console.log(result);
      }
      
      return result;
    } catch (error) {
      if (this.isGitHubActions) {
        console.log(`::error::Claude API エラー: ${error.message}`);
      }
      console.error('Claude API エラー:', error);
      throw error;
    }
  }

  buildPrompt(requirements, sampleCSVs, phase) {
    return `
あなたは優秀なフルスタック開発者です。以下の詳細な要件定義に基づいて、CSV駆動口コミ生成エージェントを実装してください。

【詳細要件定義】
${requirements}

【サンプルCSVデータ（SHOGUN BAR例）】
${sampleCSVs}

【技術スタック】
- Mastra Framework（エージェント開発）
- Claude Sonnet 4 API
- Next.js + TypeScript（フロントエンド）
- Netlify（デプロイ）
- Supabase（データベース）

【現在のプロジェクト構造】
csv-review-generator/
├── requirements/        # 詳細要件定義
├── sample-csv/         # SHOGUN BAR サンプルCSV
├── src/               # ソースコード（これから作成）
├── package.json
├── .env
└── claude-builder.js

【開発フェーズ: ${phase}】
${this.getPhaseInstructions(phase)}

実際に動作するコードを提供し、ファイル構造も明確に示してください。
現在のディレクトリ構造に合わせて、必要なファイルとコードを生成してください。
`;
  }

  getPhaseInstructions(phase) {
    const phases = {
      1: `
Phase 1: プロジェクト基盤構築
- Next.js + TypeScript プロジェクト初期化
- Mastra Framework セットアップ
- 基本的なプロジェクト構造作成
- 必要な依存関係の設定
- 環境変数の設定例
- 基本的なエージェント基盤クラス作成
      `,
      2: `
Phase 2: Mastraエージェント実装
- CSV パーサーエージェント（CSVParserAgent）の実装
- 動的プロンプトビルダーエージェント（DynamicPromptBuilderAgent）の実装
- Review生成エージェント（ReviewGeneratorAgent）の実装
- 品質管理エージェント（QualityControllerAgent）の実装
- エージェント間の連携設定
- 各エージェントの TypeScript 型定義
- Mastra ワークフロー定義
      `,
      3: `
Phase 3: フロントエンド実装
- CSV アップロード UI（react-dropzone使用）
- 生成設定 UI（件数選択、年代分散設定）
- 結果表示・ダウンロード機能
- Supabase との連携（生成結果保存）
- Tailwind CSS でのスタイリング
- レスポンシブ対応
      `,
      4: `
Phase 4: 統合とテスト
- 全エージェントの統合テスト
- エラーハンドリングの実装
- SHOGUN BAR サンプルでの動作確認
- デプロイ設定（Netlify対応）
- README.md 作成
- 最終調整
      `
    };
    return phases[phase] || phases[1];
  }

  async createFilesFromResponse(response) {
    // Claude の回答からファイル作成指示を解析して自動実行
    // この部分は Claude の回答形式に応じて実装
    console.log('::notice::ファイル自動生成機能は実装予定');
  }
}

// 実行部分
async function main() {
  const builder = new ClaudeCodeBuilder();
  
  console.log('🚀 CSV駆動口コミ生成エージェント構築開始...');
  console.log('📂 Requirements フォルダから要件定義を読み込み中...');
  
  try {
    // Phase 2: Mastraエージェント実装
    console.log('\n🤖 Phase 2: Mastraエージェント実装');
    await builder.buildProject(2);
    
  } catch (error) {
    console.error('❌ エラー:', error.message);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

module.exports = ClaudeCodeBuilder;