/**
 * @file IntelligentQAKnowledgeAgent.ts
 * @description 知的QAナレッジ管理エージェント
 * QAナレッジから共通パターンを抽出し、汎用的な禁止事項を生成
 * いたちごっこを回避し、共通禁止事項を効果的に管理
 */
import { Agent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';
import { CSVConfig } from '../types/csv';
import { GeneratedReview } from '../types/review';
import { EnhancedQAProhibitionController } from './EnhancedQAProhibitionController';
import type { EnhancedQAViolation, ProhibitionRule as EnhancedProhibitionRule } from './EnhancedQAProhibitionController';

/**
 * QAナレッジ分析結果の型定義
 */
interface QAAnalysisResult {
  commonPatterns: QAPattern[];
  prohibitionRules: ProhibitionRule[];
  preventiveGuidance: string;
}

/**
 * QAパターンの型定義
 */
interface QAPattern {
  patternType: '表現パターン' | '内容パターン' | '構造パターン';
  description: string;
  frequency: '高' | '中' | '低';
  examples: string[];
  rootCause: string;
}

/**
 * 禁止ルールの型定義
 */
interface ProhibitionRule {
  ruleType: '汎用ルール' | '特定ルール';
  rule: string;
  reasoning: string;
  scope: string;
  preventionLevel: '高' | '中' | '低';
}

/**
 * 品質チェック結果の型定義
 */
interface QualityCheckResult {
  passed: boolean;
  violations: QualityViolation[];
  recommendations: string[];
  preventiveGuidance: string;
}

/**
 * 品質違反の型定義
 */
interface QualityViolation {
  type: string;
  description: string;
  severity: '高' | '中' | '低';
  relatedQA?: string;
}

/**
 * 🧠 知的QAナレッジマネージャー
 * QAナレッジから共通パターンを抽出し、汎用的な禁止事項を生成
 */
export class IntelligentQAKnowledgeAgent extends Agent {
  private knowledgeBase: any[] = [];
  private commonPatterns: QAPattern[] = [];
  private learningHistory: any[] = [];
  private enhancedProhibitionController: EnhancedQAProhibitionController;

  constructor() {
    super({
      name: 'Intelligent QA Knowledge Agent',
      instructions: `
        あなたはQAナレッジを分析し、共通的な品質問題を特定する専門エージェントです。
        
        主な責務:
        1. QAナレッジから共通パターンを抽出
        2. 汎用的な禁止ルールを生成
        3. 新しい問題への予防的対応
        4. いたちごっこを回避する根本的解決
        
        分析時は以下の観点を重視してください:
        - パターンの根本原因を特定
        - 予防効果の高いルールを優先
        - 汎用性と具体性のバランス
        - 実装可能性を考慮
      `,
      model: anthropic('claude-3-5-sonnet-20241022')
    });
    
    // 強化されたQA禁止事項制御システムを初期化
    this.enhancedProhibitionController = new EnhancedQAProhibitionController();
  }

  /**
   * 🔍 QAナレッジから共通パターンを抽出
   */
  async analyzeQAKnowledge(qaKnowledge: any[]): Promise<QAAnalysisResult> {
    console.log('🧠 QAナレッジ分析開始...', { qaCount: qaKnowledge.length });
    
    try {
      // AI分析でパターン抽出
      const analysisPrompt = `
以下のQAナレッジを分析し、共通する問題パターンを特定してください：

QAナレッジ（最新20件）:
${qaKnowledge.slice(-20).map((qa, i) => `
Q${i+1}: ${qa.question}
A${i+1}: ${qa.answer}
カテゴリ: ${qa.category}
優先度: ${qa.priority}
改善前: ${qa.example_before || 'なし'}
改善後: ${qa.example_after || 'なし'}
`).join('\n')}

以下のJSON形式で分析結果を出力してください：
{
  "commonPatterns": [
    {
      "patternType": "表現パターン|内容パターン|構造パターン",
      "description": "パターンの説明",
      "frequency": "高|中|低",
      "examples": ["例1", "例2", "例3"],
      "rootCause": "根本原因"
    }
  ],
  "prohibitionRules": [
    {
      "ruleType": "汎用ルール|特定ルール",
      "rule": "ルールの内容",
      "reasoning": "なぜこのルールが必要か",
      "scope": "適用範囲",
      "preventionLevel": "高|中|低"
    }
  ],
  "preventiveGuidance": "今後の問題を予防するための汎用的な指針"
}
`;

      const analysisResult = await this.generate(analysisPrompt);
      const analysis = this.parseAnalysisResult(analysisResult.text || analysisResult.toString());
      
      // 学習履歴に記録
      this.learningHistory.push({
        timestamp: new Date().toISOString(),
        analysisCount: qaKnowledge.length,
        patternsFound: analysis.commonPatterns.length,
        rulesGenerated: analysis.prohibitionRules.length
      });

      console.log('✅ QAナレッジ分析完了:', {
        共通パターン: analysis.commonPatterns.length,
        禁止ルール: analysis.prohibitionRules.length,
        予防指針: analysis.preventiveGuidance ? '生成済み' : '未生成'
      });

      return analysis;
    } catch (error) {
      console.error('❌ QAナレッジ分析エラー:', error);
      return {
        commonPatterns: [],
        prohibitionRules: [],
        preventiveGuidance: 'QAナレッジ分析中にエラーが発生しました。'
      };
    }
  }

  /**
   * 🛡️ リアルタイム品質チェック（QAナレッジベース）
   * 強化されたQA禁止事項制御システムを統合
   */
  async performQABasedQualityCheck(
    reviewText: string,
    qaKnowledge: any[]
  ): Promise<QualityCheckResult> {
    try {
      // 1. 強化された違反検出システム
      const enhancedViolations = await this.enhancedProhibitionController.detectViolations(reviewText, qaKnowledge);
      
      // 2. 従来の直接違反チェック
      const directViolations = this.checkDirectViolations(reviewText, qaKnowledge);
      
      // 3. AI駆動の品質判定
      const aiJudgement = await this.performAIQualityJudgement(reviewText, qaKnowledge);
      
      // 4. パターンベースの予防的チェック
      const patternViolations = this.checkPatternViolations(reviewText);
      
      // 5. 強化された違反を従来形式に変換
      const convertedEnhancedViolations = enhancedViolations.map(violation => ({
        type: violation.type,
        description: `${violation.description} (信頼度: ${Math.round(violation.confidence * 100)}%)`,
        severity: violation.severity,
        relatedQA: violation.relatedQA
      }));
      
      const allViolations = [...convertedEnhancedViolations, ...directViolations, ...patternViolations, ...aiJudgement.violations];
      
      console.log('🛡️ 強化されたQA品質チェック完了:', {
        強化された違反: enhancedViolations.length,
        直接違反: directViolations.length,
        パターン違反: patternViolations.length,
        AI判定違反: aiJudgement.violations?.length || 0,
        総違反数: allViolations.length
      });
      
      return {
        passed: allViolations.length === 0,
        violations: allViolations,
        recommendations: this.generateRecommendations(allViolations, qaKnowledge),
        preventiveGuidance: aiJudgement.preventiveGuidance
      };
    } catch (error) {
      console.error('❌ QAベース品質チェックエラー:', error);
      return {
        passed: false,
        violations: [{
          type: 'システムエラー',
          description: '品質チェック中にエラーが発生しました',
          severity: '高'
        }],
        recommendations: ['システム管理者に連絡してください'],
        preventiveGuidance: 'システムの安定性を確認してください'
      };
    }
  }

  /**
   * 🔧 強化されたQA禁止事項制御システムの初期化
   */
  async initializeEnhancedProhibitionSystem(qaKnowledge: any[]): Promise<void> {
    try {
      console.log('🔧 強化されたQA禁止事項制御システム初期化開始...');
      
      // 禁止ルールの動的生成
      const prohibitionRules = this.enhancedProhibitionController.generateProhibitionRules(qaKnowledge);
      
      // 階層的ルール管理
      const hierarchicalRules = this.enhancedProhibitionController.createHierarchicalRules(qaKnowledge);
      
      console.log('✅ 強化されたQA禁止事項制御システム初期化完了:', {
        総ルール数: prohibitionRules.length,
        階層別ルール: {
          致命的: hierarchicalRules.critical.length,
          高: hierarchicalRules.high.length,
          中: hierarchicalRules.medium.length,
          低: hierarchicalRules.low.length
        }
      });
    } catch (error) {
      console.error('❌ 強化されたQA禁止事項制御システム初期化エラー:', error);
    }
  }

  /**
   * 📊 強化されたQA禁止事項制御システムの統計取得
   */
  getEnhancedProhibitionStatistics(): any {
    return this.enhancedProhibitionController.getStatistics();
  }

  /**
   * 🤖 AI駆動の品質判定
   */
  private async performAIQualityJudgement(reviewText: string, qaKnowledge: any[]) {
    try {
      const judgementPrompt = `
以下のレビュー文を、QAナレッジベースに基づいて品質判定してください：

レビュー文:
"${reviewText}"

参考QAナレッジ（重要度高）:
${qaKnowledge
  .filter(qa => qa.priority === 'Critical' || qa.priority === 'High')
  .slice(0, 10)
  .map((qa, i) => `
Q: ${qa.question}
A: ${qa.answer}
避けるべき例: ${qa.example_before || 'なし'}
`).join('\n')}

以下のJSON形式で判定してください：
{
  "overallQuality": "適切|要注意|不適切",
  "violations": [
    {
      "type": "違反タイプ",
      "description": "具体的な問題",
      "severity": "高|中|低",
      "relatedQA": "関連するQA番号"
    }
  ],
  "preventiveGuidance": "今後同様の問題を避けるための指針",
  "confidenceLevel": 0.85
}
`;

      const judgement = await this.generate(judgementPrompt);
      return this.parseJudgementResult(judgement.text || judgement.toString());
    } catch (error) {
      console.error('❌ AI品質判定エラー:', error);
      return {
        violations: [],
        preventiveGuidance: 'AI判定中にエラーが発生しました'
      };
    }
  }

  /**
   * 📚 動的QAナレッジ更新提案
   */
  async proposeQAUpdates(
    newIssues: any[],
    existingQAKnowledge: any[]
  ): Promise<{
    newQAEntries: any[];
    updateSuggestions: any[];
    consolidationOpportunities: any[];
  }> {
    console.log('📚 QAナレッジ更新提案生成中...');
    
    try {
      const updatePrompt = `
新しく発見された品質問題に基づいて、QAナレッジの更新を提案してください：

新しい品質問題:
${newIssues.map((issue, i) => `
問題${i+1}: ${issue.description}
発生頻度: ${issue.frequency}
影響度: ${issue.impact}
具体例: ${issue.example}
`).join('\n')}

既存QAナレッジ数: ${existingQAKnowledge.length}件

以下のJSON形式で提案してください：
{
  "newQAEntries": [
    {
      "question": "新しいQ",
      "answer": "新しいA", 
      "category": "カテゴリ",
      "priority": "Critical|High|Medium|Low",
      "example_situation": "発生状況",
      "example_before": "問題のある例",
      "example_after": "改善された例"
    }
  ],
  "updateSuggestions": [
    {
      "targetQA": "更新対象のQA",
      "updateType": "拡張|修正|統合",
      "newContent": "更新内容",
      "reason": "更新理由"
    }
  ],
  "consolidationOpportunities": [
    {
      "qaIds": ["統合対象のQA ID"],
      "consolidatedQA": "統合後のQA",
      "benefit": "統合による利益"
    }
  ]
}
`;

      const updateProposal = await this.generate(updatePrompt);
      const proposal = this.parseUpdateProposal(updateProposal.text || updateProposal.toString());
      
      console.log('✅ QAナレッジ更新提案完了:', {
        新規エントリ: proposal.newQAEntries.length,
        更新提案: proposal.updateSuggestions.length,
        統合機会: proposal.consolidationOpportunities.length
      });

      return proposal;
    } catch (error) {
      console.error('❌ QAナレッジ更新提案エラー:', error);
      return {
        newQAEntries: [],
        updateSuggestions: [],
        consolidationOpportunities: []
      };
    }
  }

  /**
   * 直接的な違反チェック
   */
  private checkDirectViolations(reviewText: string, qaKnowledge: any[]): QualityViolation[] {
    const violations: QualityViolation[] = [];
    
    for (const qa of qaKnowledge) {
      if (qa.example_before && reviewText.includes(qa.example_before)) {
        violations.push({
          type: 'QAナレッジ違反',
          description: `${qa.question}: ${qa.example_before}を使用`,
          severity: qa.priority === 'Critical' ? '高' : qa.priority === 'High' ? '中' : '低',
          relatedQA: qa.question
        });
      }
    }
    
    return violations;
  }

  /**
   * パターンベースの違反チェック
   */
  private checkPatternViolations(reviewText: string): QualityViolation[] {
    const violations: QualityViolation[] = [];
    
    // 共通パターンに基づくチェック
    for (const pattern of this.commonPatterns) {
      for (const example of pattern.examples) {
        if (reviewText.includes(example)) {
          violations.push({
            type: `${pattern.patternType}違反`,
            description: `${pattern.description}: ${example}を検出`,
            severity: pattern.frequency === '高' ? '高' : '中'
          });
        }
      }
    }
    
    return violations;
  }

  /**
   * 推奨事項生成
   */
  private generateRecommendations(violations: QualityViolation[], qaKnowledge: any[]): string[] {
    const recommendations: string[] = [];
    
    for (const violation of violations) {
      if (violation.relatedQA) {
        const relatedQA = qaKnowledge.find(qa => qa.question === violation.relatedQA);
        if (relatedQA && relatedQA.answer) {
          recommendations.push(relatedQA.answer);
        }
      }
    }
    
    // 汎用的な推奨事項
    if (violations.length > 0) {
      recommendations.push('より具体的で自然な表現を使用してください');
      recommendations.push('読み手の立場に立った内容を心がけてください');
    }
    
    return Array.from(new Set(recommendations)); // 重複除去
  }

  /**
   * 分析結果のパース（強化版）
   */
  private parseAnalysisResult(result: string): QAAnalysisResult {
    try {
      // 1. 基本的なクリーニング
      let cleanedResult = this.cleanJSONString(result);
      
      // 2. 標準パース試行
      const parsed = JSON.parse(cleanedResult);
      return {
        commonPatterns: parsed.commonPatterns || [],
        prohibitionRules: parsed.prohibitionRules || [],
        preventiveGuidance: parsed.preventiveGuidance || ''
      };
    } catch (error) {
      console.error('❌ 分析結果パースエラー:', error);
      console.log('🔍 パース失敗した文字列:', result.substring(0, 500) + (result.length > 500 ? '...' : ''));
      
      // 3. フォールバック処理
      return {
        commonPatterns: [],
        prohibitionRules: [],
        preventiveGuidance: '分析結果の解析に失敗しました（AI応答が不完全な可能性があります）'
      };
    }
  }

  /**
   * 判定結果のパース（強化版）
   */
  private parseJudgementResult(result: string): any {
    try {
      // 1. 基本的なクリーニング
      let cleanedResult = this.cleanJSONString(result);
      
      // 2. 標準パース試行
      return JSON.parse(cleanedResult);
    } catch (error) {
      console.error('❌ 判定結果パースエラー:', error);
      console.log('🔍 パース失敗した文字列:', result.substring(0, 500) + (result.length > 500 ? '...' : ''));
      
      // 3. フォールバック: 部分的な情報を抽出
      try {
        const fallbackResult = this.extractPartialJSONInfo(result, 'judgement');
        console.log('🔧 フォールバック処理で部分情報を抽出しました');
        return fallbackResult;
      } catch (fallbackError) {
        console.error('❌ フォールバック処理も失敗:', fallbackError);
        return {
          violations: [],
          preventiveGuidance: '判定結果の解析に失敗しました（AI応答が不完全な可能性があります）'
        };
      }
    }
  }

  /**
   * 更新提案のパース（強化版）
   */
  private parseUpdateProposal(result: string): any {
    try {
      // 1. 基本的なクリーニング
      let cleanedResult = this.cleanJSONString(result);
      
      // 2. 標準パース試行
      return JSON.parse(cleanedResult);
    } catch (error) {
      console.error('❌ 更新提案パースエラー:', error);
      console.log('🔍 パース失敗した文字列:', result.substring(0, 500) + (result.length > 500 ? '...' : ''));
      
      // 3. フォールバック: 部分的な情報を抽出
      try {
        const fallbackResult = this.extractPartialJSONInfo(result, 'update');
        console.log('🔧 フォールバック処理で部分情報を抽出しました');
        return fallbackResult;
      } catch (fallbackError) {
        console.error('❌ フォールバック処理も失敗:', fallbackError);
        return {
          newQAEntries: [],
          updateSuggestions: [],
          consolidationOpportunities: []
        };
      }
    }
  }

  /**
   * 🔧 JSONストリングのクリーニング
   */
  private cleanJSONString(jsonString: string): string {
    try {
      // 1. 前後の空白とコードブロック記号を除去
      let cleaned = jsonString.trim();
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```$/, '');
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```$/, '');
      
      // 2. Unicode escape sequences の修正
      cleaned = cleaned.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      });
      
      // 3. 不正な改行やタブの修正
      cleaned = cleaned.replace(/\n/g, ' ').replace(/\t/g, ' ');
      
      // 4. 重複したスペースを単一のスペースに
      cleaned = cleaned.replace(/\s+/g, ' ');
      
      // 5. プロパティ名のクォートが抜けている場合の修正
      cleaned = cleaned.replace(/(\w+):/g, '"$1":');
      
      // 6. 文字列値のクォート修正
      cleaned = cleaned.replace(/:\s*([^",\{\[\}\]]+)(?=\s*[,\}])/g, ': "$1"');
      
      // 7. 最後のカンマを削除
      cleaned = cleaned.replace(/,(\s*[\}\]])/g, '$1');
      
      return cleaned;
    } catch (error) {
      console.error('❌ JSONクリーニング中にエラー:', error);
      return jsonString;
    }
  }

  /**
   * 🔧 部分的なJSON情報を抽出
   */
  private extractPartialJSONInfo(partialJson: string, type: 'judgement' | 'update'): any {
    try {
      // 1. 基本的な情報を抽出するパターン
      const patterns = {
        overallQuality: /"overallQuality"\s*:\s*"([^"]+)"/,
        violations: /"violations"\s*:\s*\[(.*?)\]/s,
        preventiveGuidance: /"preventiveGuidance"\s*:\s*"([^"]*)/,
        newQAEntries: /"newQAEntries"\s*:\s*\[(.*?)\]/s,
        updateSuggestions: /"updateSuggestions"\s*:\s*\[(.*?)\]/s
      };

      if (type === 'judgement') {
        // 判定結果の場合
        const result: any = {
          violations: [],
          preventiveGuidance: 'JSON解析中にエラーが発生しました'
        };

        // overallQuality を抽出
        const qualityMatch = partialJson.match(patterns.overallQuality);
        if (qualityMatch) {
          result.overallQuality = qualityMatch[1];
        }

        // preventiveGuidance を抽出
        const guidanceMatch = partialJson.match(patterns.preventiveGuidance);
        if (guidanceMatch) {
          result.preventiveGuidance = guidanceMatch[1];
        }

        // violations を簡単に抽出（完全でなくても部分的に）
        const violationsMatch = partialJson.match(patterns.violations);
        if (violationsMatch) {
          try {
            // 簡単なviolations解析
            const violationText = violationsMatch[1];
            if (violationText.includes('"type"')) {
              result.violations = [{
                type: '部分的検出',
                description: 'AI応答が不完全でしたが、何らかの違反が検出されています',
                severity: '低'
              }];
            }
          } catch (e) {
            // violations 解析失敗時はそのまま空配列
          }
        }

        return result;
      } else {
        // 更新提案の場合
        return {
          newQAEntries: [],
          updateSuggestions: [],
          consolidationOpportunities: []
        };
      }
    } catch (error) {
      console.error('❌ 部分JSON抽出エラー:', error);
      
      // 最終フォールバック
      if (type === 'judgement') {
        return {
          violations: [],
          preventiveGuidance: 'AI応答の解析に失敗しました'
        };
      } else {
        return {
          newQAEntries: [],
          updateSuggestions: [],
          consolidationOpportunities: []
        };
      }
    }
  }
} 