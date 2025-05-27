/**
 * @file ReviewGenerator.tsx
 * @description レビュー生成設定・実行コンポーネント
 * 主な機能：生成件数スライダー、プロンプト表示・編集、生成ボタン
 * 制限事項：1～100件の範囲、プロンプト編集可能、生成中の状態管理
 */
import React, { useState } from 'react';

interface ReviewGeneratorProps {
  onGenerate: (reviewCount: number, customPrompt?: string) => void;
  isGenerating: boolean;
}

export const ReviewGenerator: React.FC<ReviewGeneratorProps> = ({ onGenerate, isGenerating }) => {
  const [reviewCount, setReviewCount] = useState<number>(10);
  const [customPrompt, setCustomPrompt] = useState<string>(`🎯 CSV駆動自然口コミ生成システム - メインプロンプト

📋 重要前提
あなたはプロの口コミライターです。このプロンプトはLLM自身が直接自然な日本語口コミを創作するためのものです。

❌ スクリプト・Python等での後処理・置換は一切行わない
❌ 機械的なキーワード挿入・テンプレート処理は禁止
✅ LLM自身が人間らしい自然な文章として一から創作
✅ キーワードは文脈に完全に溶け込む形で有機的に配置
✅ CSV設定に基づく完全カスタマイズ対応

🎭 LLM創作指針
創作プロセス：
1. CSV設定からペルソナを完全に理解・体現
2. そのペルソナになりきって実際の体験として想像
3. 自然な日本語で体験談を創作
4. キーワードを意識しつつも強引な挿入は避ける
5. 年代・トーン・感嘆符設定を文体に自然反映

自然さ最優先ルール：
✅ 人間が実際に書くような文章構成
✅ 体験の流れに沿った有機的な展開
✅ ペルソナの性格・年代が滲み出る表現
✅ キーワードが「使われている感」がない統合
✅ 読み手が「この人本当に行ったんだな」と感じる説得力

🔧 CSV設定システム
Basic Rules CSV活用ルール：
- 必須要素（required_elements）: 必ず1語以上含める
- 禁止表現（prohibited_expressions）: 絶対に使用しない

Human Patterns CSV活用ルール：
- 年代・性格タイプ別の文体調整
- vocabulary列から自然な語彙選択
- exclamation_marks設定に従った感嘆符使用
- characteristics列の文体特徴を反映
- example列を参考にした表現パターン

🧩 口コミ文構成ルール
必須構成要素：
- 文字数: 150〜400字（内容優先）
- 感嘆符使用: Human Patterns CSVのexclamation_marks列に従う
- キーワード含有: Basic Rules CSVの必須要素を自然に配置
- 品質基準: 自然で説得力のある内容

👥 視点設定ルール
口コミ視点ルール：
✅ ペルソナ自身の個人的体験・感想のみ記述
✅ 「私は〜した」「〜でした」「〜と思います」の一人称視点
✅ 同伴者への言及は完全排除

NG例：「友達と楽しめた」「みんなで〜した」「一緒に〜」
OK例：「楽しめました」「体験できました」「満足できる内容でした」

❌ 禁止事項
- キーワードの羅列（自然な文脈で使用されていない）
- 単調な文型パターンの繰り返し
- 明らかな広告文・誇張
- ペルソナのcompanion情報を本文中に含める

🚀 実行指示
上記ルールに基づき、SHOGUN BAR（池袋西口のエンタメバー）の自然な口コミを生成してください。

重要：スクリプト処理や機械的置換は一切行わず、あなた自身が一人の人間として体験したかのように、感情と具体性を込めて文章を創作してください。キーワードは意識しますが、強引な挿入は避け、体験談の自然な流れの中で有機的に配置してください。`);

  /**
   * 生成件数変更ハンドラー
   * @param value 新しい生成件数
   */
  const handleReviewCountChange = (value: number) => {
    setReviewCount(Math.max(1, Math.min(30, value))); // シンプル版では30件まで
  };

  /**
   * 生成開始ハンドラー
   */
  const handleGenerate = () => {
    console.log('🎯 ReviewGenerator handleGenerate 開始:', { 
      reviewCount, 
      isGenerating, 
      customPromptLength: customPrompt.length 
    });
    
    if (isGenerating) {
      console.log('⚠️ 既に生成中のため処理をスキップ');
      return;
    }
    
    console.log('📞 onGenerate呼び出し:', { reviewCount, customPrompt: customPrompt.substring(0, 100) + '...' });
    onGenerate(reviewCount, customPrompt);
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-6">
      <div className="space-y-6">
        {/* 生成件数設定 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            生成件数: {reviewCount}件
          </label>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">1</span>
            <input
              type="range"
              min="1"
              max="30"
              value={reviewCount}
              onChange={(e) => handleReviewCountChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              disabled={isGenerating}
            />
            <span className="text-sm text-gray-500">30</span>
          </div>
          <div className="mt-2">
            <input
              type="number"
              min="1"
              max="30"
              value={reviewCount}
              onChange={(e) => handleReviewCountChange(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-1 border border-gray-300 rounded text-sm"
              disabled={isGenerating}
            />
            <span className="ml-2 text-sm text-gray-600">件</span>
          </div>
        </div>

        {/* プロンプト編集エリア */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            AIプロンプト（編集可能）
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="メインプロンプトが設定されています。CSVアップロード後、さらに詳細化されます。必要に応じて編集してください。"
            className="w-full h-48 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-vertical"
            disabled={isGenerating}
          />
          <p className="mt-1 text-xs text-gray-500">
            ※ メインプロンプトが設定済み。CSVアップロード後、さらに詳細化されます。必要に応じて編集可能です。
          </p>
        </div>

        {/* 生成設定オプション */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              年齢層分布
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              disabled={isGenerating}
            >
              <option value="auto">自動（CSVパターンに基づく）</option>
              <option value="20s">20代中心</option>
              <option value="30s">30代中心</option>
              <option value="40s">40代中心</option>
              <option value="mixed">バランス型</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              性別分布
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              disabled={isGenerating}
            >
              <option value="auto">自動（CSVパターンに基づく）</option>
              <option value="male">男性中心</option>
              <option value="female">女性中心</option>
              <option value="balanced">バランス型</option>
            </select>
          </div>
        </div>

        {/* テストボタン（診断用） */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-800 mb-3">🧪 Netlify環境診断</h3>
          
          <div className="space-y-2">
            {/* QA強化版テストボタン */}
            <button
              onClick={async () => {
                try {
                  console.log('🧠 QA強化版テスト開始...');
                  const response = await fetch('/api/generate-reviews-qa-enhanced', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      csvConfig: {
                        basicRules: [
                          { category: 'required_elements', type: 'area', content: '池袋西口' },
                          { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                          { category: 'required_elements', type: 'usp', content: '日本酒' }
                        ],
                        humanPatterns: [
                          { age_group: '20代', personality_type: 'フレンドリー' },
                          { age_group: '30代', personality_type: '落ち着いた' }
                        ],
                        qaKnowledge: [
                          {
                            question: "曖昧な表現を避けるには？",
                            answer: "具体的な体験や数値を含める",
                            category: "表現問題",
                            priority: "High",
                            example_before: "とても良かった",
                            example_after: "スタッフの対応が丁寧で、料理も熱々で美味しかった"
                          }
                        ]
                      },
                      reviewCount: 3,
                      enableQAEnhancement: true,
                      qualityThreshold: 0.7
                    })
                  });
                  
                  const result = await response.json();
                  console.log('🧠 QA強化版テスト結果:', result);
                  
                  if (result.success) {
                    alert(`🧠 QA強化版テスト成功！\n生成件数: ${result.count}件\n平均品質: ${result.statistics.averageQuality.toFixed(2)}\n承認件数: ${result.statistics.approvedCount}件`);
                  } else {
                    alert(`❌ QA強化版テスト失敗: ${result.error}`);
                  }
                } catch (error) {
                  console.error('QA強化版テストエラー:', error);
                  alert(`❌ QA強化版テストエラー: ${error}`);
                }
              }}
              className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
              disabled={isGenerating}
            >
              🧠 QA強化版テスト（3件）
            </button>
            <button
              onClick={async () => {
                try {
                  console.log('🧪 テストAPI呼び出し開始');
                  const response = await fetch('/api/test-simple', {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json'
                    }
                  });
                  
                  const result = await response.json();
                  console.log('🧪 テストAPI結果:', result);
                  
                  if (response.ok) {
                    alert(`✅ 環境テスト成功!\n\nNode.js: ${result.environment.nodeVersion}\nプラットフォーム: ${result.environment.platform}\nAnthropic API Key: ${result.environment.hasAnthropicKey ? '設定済み' : '未設定'}\n\nfetchテスト: ${result.fetchTest.status === 200 ? '成功' : '失敗'}`);
                  } else {
                    alert(`❌ 環境テスト失敗: ${result.error?.message || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('🧪 テストAPI呼び出しエラー:', error);
                  alert(`❌ 環境テスト呼び出しエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-4 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 mr-2"
            >
              環境テスト実行
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('🔬 軽量版レビュー生成テスト開始');
                  const response = await fetch('/api/generate-reviews-lite', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      csvConfig: { humanPatterns: [{ age_group: '30代', personality_type: 'テスト' }] },
                      reviewCount: 1
                    })
                  });
                  
                  const result = await response.json();
                  console.log('🔬 軽量版テスト結果:', result);
                  
                  if (response.ok && Array.isArray(result) && result.length > 0) {
                    alert(`✅ 軽量版レビュー生成成功!\n\n生成されたレビュー:\n"${result[0].reviewText}"\n\n文字数: ${result[0].reviewText.length}文字\nスコア: ${result[0].qualityScore}`);
                  } else {
                    alert(`❌ 軽量版レビュー生成失敗: ${result.error?.message || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('🔬 軽量版テストエラー:', error);
                  alert(`❌ 軽量版テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              軽量版テスト
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('🔬 最小限レビュー生成テスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-minimal', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig
                    })
                  });
                  
                  const result = await response.json();
                  console.log('🔬 最小限テスト結果:', result);
                  
                  if (response.ok && Array.isArray(result) && result.length > 0) {
                    alert(`✅ 最小限レビュー生成成功!\n\n生成されたレビュー:\n"${result[0].reviewText}"\n\n文字数: ${result[0].reviewText.length}文字\nエリア: ${result[0].generationParameters.selectedArea}\n業種: ${result[0].generationParameters.selectedBusinessType}\n特徴: ${result[0].generationParameters.selectedUSP}`);
                  } else {
                    alert(`❌ 最小限レビュー生成失敗: ${result.error?.message || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('🔬 最小限テストエラー:', error);
                  alert(`❌ 最小限テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 mr-2"
            >
              最小限テスト（CSV使用）
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('⚡ 超軽量版レビュー生成テスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-ultra-lite', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig
                    })
                  });
                  
                  const result = await response.json();
                  console.log('⚡ 超軽量版テスト結果:', result);
                  
                  if (response.ok && Array.isArray(result) && result.length > 0) {
                    alert(`✅ 超軽量版レビュー生成成功!\n\n生成されたレビュー:\n"${result[0].reviewText}"\n\n文字数: ${result[0].reviewText.length}文字\nモード: ${result[0].generationParameters.mode}`);
                  } else {
                    alert(`❌ 超軽量版レビュー生成失敗: ${result.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('⚡ 超軽量版テストエラー:', error);
                  alert(`❌ 超軽量版テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 mr-2"
            >
              超軽量版テスト（1件）
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('🔧 シンプル版レビュー生成テスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' },
                      { age_group: '20代', personality_type: 'フレンドリー' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-simple', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig,
                      reviewCount: 5
                    })
                  });
                  
                  const result = await response.json();
                  console.log('🔧 シンプル版テスト結果:', result);
                  
                  if (response.ok && Array.isArray(result) && result.length > 0) {
                    const summary = result.map((review, index) => 
                      `${index + 1}. "${review.reviewText.substring(0, 40)}..." (${review.reviewText.length}文字)`
                    ).join('\n');
                    alert(`✅ シンプル版レビュー生成成功!\n\n生成件数: ${result.length}件\n\n${summary}`);
                  } else {
                    alert(`❌ シンプル版レビュー生成失敗: ${result.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('🔧 シンプル版テストエラー:', error);
                  alert(`❌ シンプル版テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 mr-2"
            >
              シンプル版テスト（5件）
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('🔍 デバッグ版レビュー生成テスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-debug', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig
                    })
                  });
                  
                  const result = await response.json();
                  console.log('🔍 デバッグ版テスト結果:', result);
                  
                  if (response.ok && Array.isArray(result) && result.length > 0) {
                    alert(`✅ デバッグ版レビュー生成成功!\n\n生成されたレビュー:\n"${result[0].reviewText}"\n\n文字数: ${result[0].reviewText.length}文字\nモード: ${result[0].generationParameters.mode}`);
                  } else {
                    const errorInfo = result.details ? 
                      `\n\nエラー詳細:\nタイプ: ${result.details.errorType}\nメッセージ: ${result.details.errorMessage}` : '';
                    alert(`❌ デバッグ版レビュー生成失敗: ${result.error || 'Unknown error'}${errorInfo}`);
                  }
                } catch (error) {
                  console.error('🔍 デバッグ版テストエラー:', error);
                  alert(`❌ デバッグ版テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              🔍 デバッグ版テスト（詳細ログ）
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('🧠 知的化レビュー生成テスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' },
                      { age_group: '20代', personality_type: 'フレンドリー' },
                      { age_group: '40代', personality_type: '丁寧' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' },
                      { category: 'required_elements', type: 'environment', content: 'アクセス抜群' },
                      { category: 'recommendation_phrases', content: '日本酒好きに' }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-intelligent', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig,
                      reviewCount: 5
                    }),
                  });
                  
                  const result = await response.json();
                  console.log('🧠 知的化テスト結果:', result);
                  
                  if (result.success) {
                    const summary = result.reviews.map((review: any, index: number) => 
                      `${index + 1}. "${review.reviewText.substring(0, 40)}..." (品質: ${review.qualityScore.toFixed(2)})`
                    ).join('\n');
                    alert(`✅ 知的化レビュー生成成功！\n\n生成数: ${result.count}件\n平均品質: ${result.qualityAnalysis?.average || 'N/A'}\n\n${summary}\n\n🧠 知的化機能:\n✓ 多様性向上\n✓ 品質監視\n✓ 戦略調整\n✓ 知的スコアリング`);
                  } else {
                    alert(`❌ 知的化レビュー生成失敗: ${result.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('🧠 知的化テストエラー:', error);
                  alert(`❌ 知的化テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 mt-2 w-full"
            >
              🧠 知的化テスト（Phase 1機能）
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('🚀 最適化バッチ処理テスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' },
                      { age_group: '20代', personality_type: 'フレンドリー' },
                      { age_group: '40代', personality_type: '丁寧' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' },
                      { category: 'required_elements', type: 'environment', content: 'アクセス抜群' },
                      { category: 'recommendation_phrases', content: '日本酒好きに' }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-optimized', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig,
                      reviewCount: 5,
                      enableQualityFilter: true,
                      qualityThreshold: 0.7,
                      batchConfig: {
                        concurrency: 3,
                        retryAttempts: 2,
                        rateLimitPerSecond: 8
                      }
                    }),
                  });
                  
                  const result = await response.json();
                  console.log('🚀 最適化バッチ処理テスト結果:', result);
                  
                  if (result.success) {
                    const summary = result.reviews.map((review: any, index: number) => 
                      `${index + 1}. "${review.reviewText.substring(0, 40)}..." (品質: ${review.qualityScore.toFixed(2)})`
                    ).join('\n');
                    
                    const performanceInfo = `
🚀 パフォーマンス統計:
• 総処理時間: ${result.performance.totalProcessingTime}ms
• 平均処理時間: ${result.performance.averageProcessingTime.toFixed(1)}ms
• 成功率: ${(result.performance.successRate * 100).toFixed(1)}%
• スループット: ${result.performance.throughput.toFixed(2)} reviews/sec

⚡ システム状態:
• レート制限: ${result.systemStatus.rateLimiterStatus.currentRequests}/${result.systemStatus.rateLimiterStatus.limit} req/sec
• サーキットブレーカー: ${result.systemStatus.circuitBreakerStatus.state}
• 失敗回数: ${result.systemStatus.circuitBreakerStatus.failureCount}`;

                    alert(`✅ 最適化バッチ処理成功！\n\n生成数: ${result.reviews.length}件\n\n${summary}\n${performanceInfo}\n\n🚀 最適化機能:\n✓ 並列処理\n✓ エラー回復\n✓ レート制限\n✓ サーキットブレーカー\n✓ 品質フィルタリング`);
                  } else {
                    alert(`❌ 最適化バッチ処理失敗: ${result.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  console.error('🚀 最適化バッチ処理テストエラー:', error);
                  alert(`❌ 最適化バッチ処理テストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 mt-2 w-full"
            >
              🚀 最適化バッチ処理テスト（5件）
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('🔒 型安全システムテスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' },
                      { age_group: '20代', personality_type: 'フレンドリー' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' }
                    ],
                    qaKnowledge: [
                      {
                        question: "曖昧な表現を避けるには？",
                        answer: "具体的な体験や数値を含める",
                        category: "表現問題",
                        priority: "High",
                        example_before: "とても良かった",
                        example_after: "スタッフの対応が丁寧で、料理も熱々で美味しかった"
                      },
                      {
                        question: "断定的表現を避けるには？",
                        answer: "個人的な感想として表現する",
                        category: "内容問題", 
                        priority: "Medium",
                        example_before: "絶対におすすめ",
                        example_after: "個人的にはおすすめです"
                      }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-type-safe', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig,
                      reviewCount: 3,
                      enableQualityCheck: true,
                      qualityThreshold: 0.7,
                      enableStrictValidation: true
                    }),
                  });
                  
                  const result = await response.json();
                  console.log('🔒 型安全システムテスト結果:', result);
                  
                  if (result.success) {
                    const summary = result.reviews.map((review: any, index: number) => 
                      `${index + 1}. "${review.reviewText.substring(0, 40)}..." (品質: ${review.qualityScore.toFixed(2)})`
                    ).join('\n');
                    
                    const qualityInfo = `
🔒 型安全性統計:
• 平均品質スコア: ${result.statistics.averageQualityScore.toFixed(2)}
• 品質チェック合格: ${result.statistics.passedQualityCheck}件
• 品質チェック不合格: ${result.statistics.failedQualityCheck}件
• 検証エラー: ${result.statistics.validationErrors}件

📊 品質分析:
• 総合品質: ${result.qualityAnalysis?.overallQuality || 'N/A'}
• 推奨事項数: ${result.qualityAnalysis?.recommendations?.length || 0}件
• 一般的な違反: ${result.qualityAnalysis?.commonViolations?.length || 0}件`;

                    alert(`✅ 型安全システムテスト成功！\n\n生成数: ${result.count}件\n\n${summary}\n${qualityInfo}\n\n🔒 型安全機能:\n✓ Result型パターン\n✓ 包括的型検証\n✓ カスタムエラー型\n✓ QAナレッジ統合\n✓ 詳細品質分析`);
                  } else {
                    const errorInfo = result.error ? 
                      `\nエラー詳細:\n• コード: ${result.error.code}\n• カテゴリ: ${result.error.category}\n• メッセージ: ${result.error.message}` : '';
                    alert(`❌ 型安全システムテスト失敗: ${result.error?.message || 'Unknown error'}${errorInfo}`);
                  }
                } catch (error) {
                  console.error('🔒 型安全システムテストエラー:', error);
                  alert(`❌ 型安全システムテストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 mt-2 w-full"
            >
              🔒 型安全システムテスト（3件）
            </button>

            <button
              onClick={async () => {
                try {
                  console.log('⚙️ 設定管理システムテスト開始');
                  const testCsvConfig = {
                    humanPatterns: [
                      { age_group: '30代', personality_type: 'カジュアル' },
                      { age_group: '20代', personality_type: 'フレンドリー' }
                    ],
                    basicRules: [
                      { category: 'required_elements', type: 'area', content: '池袋西口' },
                      { category: 'required_elements', type: 'business_type', content: 'SHOGUN BAR' },
                      { category: 'required_elements', type: 'usp', content: '日本酒' }
                    ],
                    qaKnowledge: [
                      {
                        question: "曖昧な表現を避けるには？",
                        answer: "具体的な体験や数値を含める",
                        category: "表現問題",
                        priority: "High",
                        example_before: "とても良かった",
                        example_after: "スタッフの対応が丁寧で、料理も熱々で美味しかった"
                      }
                    ]
                  };
                  
                  const response = await fetch('/api/generate-reviews-config-managed', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      csvConfig: testCsvConfig,
                      reviewCount: 3,
                      enableQualityCheck: true,
                      qualityThreshold: 0.7,
                      enableStrictValidation: true,
                      overrideConfig: {
                        'api.claude.temperature': 0.9,
                        'quality.thresholds.minimumScore': 6.0,
                        'processing.batch.defaultConcurrency': 2
                      }
                    }),
                  });
                  
                  const result = await response.json();
                  console.log('⚙️ 設定管理システムテスト結果:', result);
                  
                  if (result.success) {
                    const summary = result.reviews.map((review: any, index: number) => 
                      `${index + 1}. "${review.reviewText.substring(0, 40)}..." (品質: ${review.qualityScore.toFixed(2)})`
                    ).join('\n');
                    
                    const configInfo = `
⚙️ 設定管理統計:
• 設定検証: ${result.configurationStatus.isValid ? '✅ 正常' : '❌ エラー'}
• アクティブモデル: ${result.configurationStatus.activeConfig.apiModel}
• 品質閾値: ${result.configurationStatus.activeConfig.qualityThreshold}
• バッチ並列数: ${result.configurationStatus.activeConfig.batchConcurrency}
• 監視有効: ${result.configurationStatus.activeConfig.enableMonitoring ? '✅' : '❌'}
• ログレベル: ${result.configurationStatus.activeConfig.logLevel}
• 設定オーバーライド: ${result.statistics.configurationOverrides}件

🏥 システムヘルス:
• 全体ステータス: ${result.systemHealth.status === 'healthy' ? '✅ 正常' : '❌ 異常'}
• API接続: ${result.systemHealth.checks.api?.status === 'healthy' ? '✅' : '❌'}
• 設定状態: ${result.systemHealth.checks.configuration?.status === 'healthy' ? '✅' : '❌'}
• アクティブアラート: ${result.systemHealth.alerts.length}件`;

                    alert(`✅ 設定管理システムテスト成功！\n\n生成数: ${result.count}件\n\n${summary}\n${configInfo}\n\n⚙️ 設定管理機能:\n✓ 外部設定読み込み\n✓ 動的設定更新\n✓ 設定検証\n✓ ヘルスチェック\n✓ 運用監視\n✓ アラート機能`);
                  } else {
                    const errorInfo = result.error ? 
                      `\nエラー詳細:\n• コード: ${result.error.code}\n• カテゴリ: ${result.error.category}\n• メッセージ: ${result.error.message}` : '';
                    alert(`❌ 設定管理システムテスト失敗: ${result.error?.message || 'Unknown error'}${errorInfo}`);
                  }
                } catch (error) {
                  console.error('⚙️ 設定管理システムテストエラー:', error);
                  alert(`❌ 設定管理システムテストエラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }}
              className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 mt-2 w-full"
            >
              ⚙️ 設定管理システムテスト（3件）
            </button>
          </div>
          
          <p className="text-xs text-yellow-700 mt-2">
            環境テスト: Netlify環境での動作確認<br/>
            軽量版テスト: Claude APIでの1件レビュー生成確認<br/>
            最小限テスト: CSV設定を使った1件レビュー生成確認<br/>
            超軽量版テスト: 最適化版ベースの1件生成確認<br/>
            シンプル版テスト: 重複チェックなしの5件生成確認<br/>
            🔍 デバッグ版テスト: 詳細ログ付き1件生成（エラー原因特定用）<br/>
            🧠 知的化テスト: Phase 1知的化機能（多様性・品質監視・戦略調整）<br/>
            🚀 最適化バッチ処理テスト: 並列処理・エラー回復・レート制限・サーキットブレーカー<br/>
            🔒 型安全システムテスト: Result型パターン・包括的型検証・カスタムエラー型・QAナレッジ統合<br/>
            ⚙️ 設定管理システムテスト: 外部設定・動的更新・ヘルスチェック・運用監視・アラート機能
          </p>
        </div>

        {/* 生成ボタン */}
        <div className="flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`px-8 py-3 rounded-lg font-medium text-white transition-colors ${
              isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>生成中...</span>
              </div>
            ) : (
              `${reviewCount}件のレビューを生成`
            )}
          </button>
        </div>

        {/* 生成時間の目安 */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            予想生成時間: 約{Math.ceil(reviewCount * 0.6)}分 (シンプル版)
            {reviewCount <= 15 && ' (高速処理)'}
          </p>
        </div>
      </div>
    </div>
  );
}; 