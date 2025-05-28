// claude-builder.js
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Claude Code Builder
 * GitHub Actionsから呼び出される自動開発システム
 */
class ClaudeCodeBuilder {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.phase = process.env.CLAUDE_PHASE || '2';
    this.projectContext = '';
  }

  async initialize() {
    console.log('🤖 Claude Code Builder 初期化中...');
    console.log(`📋 Phase: ${this.phase}`);
    
    // プロジェクト情報を読み込み
    await this.loadProjectContext();
  }

  async loadProjectContext() {
    console.log('📖 プロジェクト情報読み込み中...');
    
    let context = `
【プロジェクト】CSV駆動口コミ生成AIエージェント

【技術スタック】
- Mastra Framework
- Claude Sonnet 4 API
- Next.js + TypeScript
- Supabase

【現在のフェーズ】Phase ${this.phase}
`;

    // 要件定義ファイルを読み込み
    try {
      const requirementsPath = './requirements';
      const files = await fs.readdir(requirementsPath);
      
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(requirementsPath, file), 'utf8');
          context += `\n\n### ${file}\n${content}`;
        }
      }
    } catch (error) {
      console.log('⚠️ Requirements フォルダが見つかりません');
    }

    // 既存コード構造を分析
    try {
      const srcFiles = await this.analyzeSrcStructure();
      if (srcFiles.length > 0) {
        context += '\n\n### 既存ファイル構造\n';
        context += srcFiles.join('\n');
      }
    } catch (error) {
      console.log('⚠️ src フォルダが見つかりません');
    }

    this.projectContext = context;
  }

  async analyzeSrcStructure() {
    const files = [];
    
    try {
      const srcPath = './src';
      const entries = await fs.readdir(srcPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(srcPath, entry.name);
          const subFiles = await fs.readdir(subPath);
          files.push(`- ${entry.name}/`);
          subFiles.forEach(file => {
            files.push(`  - ${file}`);
          });
        } else {
          files.push(`- ${entry.name}`);
        }
      }
    } catch (error) {
      // src フォルダが存在しない場合は空配列を返す
    }
    
    return files;
  }

  async buildPhase() {
    console.log(`🏗️ Phase ${this.phase} 開発開始...`);
    
    const phasePrompts = {
      '1': this.getPhase1Prompt(),
      '2': this.getPhase2Prompt(),
      '3': this.getPhase3Prompt(),
      '4': this.getPhase4Prompt(),
      '5': this.getPhase5Prompt()
    };

    const prompt = phasePrompts[this.phase] || phasePrompts['2'];
    
    try {
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      });

      const result = response.content[0].text;
      console.log('\n🤖 Claude からの回答:\n');
      console.log(result);
      
      return result;
    } catch (error) {
      console.error('❌ Claude API エラー:', error);
      throw error;
    }
  }

  getPhase1Prompt() {
    return `
あなたは優秀なフルスタック開発者です。

${this.projectContext}

Phase 1: プロジェクト基盤の構築を行ってください。

【Phase 1 の実装内容】
1. プロジェクト構造の設計
2. 基本的なTypeScript設定
3. Mastraフレームワークの基本設定
4. 型定義ファイルの作成

以下の形式で実装してください：

\`\`\`typescript
// ファイル名をコメントで明記
// src/types/review.ts
export interface ReviewRequest {
  // 型定義
}
\`\`\`

実装すべきファイル：
- tsconfig.json
- src/types/review.ts
- src/types/csv.ts
- package.json の更新
- 基本的なプロジェクト構造
`;
  }

  getPhase2Prompt() {
    return `
あなたは優秀なフルスタック開発者です。

${this.projectContext}

Phase 2: Mastraエージェントの実装を行ってください。

【Phase 2 の実装内容】
1. CSVパーサーエージェント
2. レビュー生成エージェント  
3. 品質管理エージェント
4. エージェント間の連携

以下の形式で実装してください：

\`\`\`typescript
// ファイル名をコメントで明記  
// src/agents/ReviewGeneratorAgent.ts
import { Agent } from '@mastra/core';

export class ReviewGeneratorAgent extends Agent {
  // 実装
}
\`\`\`

実装すべきエージェント：
- CSVParserAgent
- ReviewGeneratorAgent
- QualityControllerAgent
- DynamicPromptBuilderAgent

各エージェントは以下の要件を満たしてください：
- Mastraフレームワークを使用
- 適切なエラーハンドリング
- TypeScriptで型安全な実装
- テスト可能な構造
`;
  }

  getPhase3Prompt() {
    return `
あなたは優秀なフルスタック開発者です。

${this.projectContext}

Phase 3: フロントエンド実装を行ってください。

【Phase 3 の実装内容】
1. Next.js アプリケーション構造
2. CSVアップロードコンポーネント
3. レビュー生成フォーム
4. 結果表示コンポーネント

以下の形式で実装してください：

\`\`\`typescript
// ファイル名をコメントで明記
// src/components/UploadForm.tsx
import React from 'react';

export const UploadForm: React.FC = () => {
  // 実装
};
\`\`\`

実装すべきコンポーネント：
- UploadForm (CSVアップロード)
- ReviewForm (レビュー生成設定)
- ResultDisplay (結果表示)
- Layout (全体レイアウト)
`;
  }

  getPhase4Prompt() {
    return `
あなたは優秀なフルスタック開発者です。

${this.projectContext}

Phase 4: 統合・テスト実装を行ってください。

【Phase 4 の実装内容】
1. エージェント統合システム
2. テストコードの作成
3. エラーハンドリングの強化
4. パフォーマンス最適化

統合とテストに必要な実装を行ってください。
`;
  }

  getPhase5Prompt() {
    return `
あなたは優秀なフルスタック開発者です。

${this.projectContext}

Phase 5: 新機能追加を行ってください。

【Phase 5 の実装内容】
1. 追加機能の実装
2. 既存機能の改善
3. UI/UXの向上
4. 新しい要件への対応

現在の要求に基づいて新機能を実装してください。
`;
  }
}

// メイン実行
async function main() {
  try {
    const builder = new ClaudeCodeBuilder();
    await builder.initialize();
    await builder.buildPhase();
  } catch (error) {
    console.error('❌ Build エラー:', error);
    process.exit(1);
  }
}

// スクリプト直接実行時
if (require.main === module) {
  main();
}

module.exports = { ClaudeCodeBuilder };