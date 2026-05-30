import type {
  AIDriveGoal,
  HumanApprovalGate,
  PromptCopyButton,
  VaultPreview,
  ReviewLink,
} from '@/types/ai-drive'

import Header from '@/components/ai-drive/Header'
import MainGoalCard from '@/components/ai-drive/MainGoalCard'
import StageFlow from '@/components/ai-drive/StageFlow'
import HumanApprovalGates from '@/components/ai-drive/HumanApprovalGates'
import PromptCopyButtons from '@/components/ai-drive/PromptCopyButtons'
import VaultPreviewPanel from '@/components/ai-drive/VaultPreview'
import GoalListCards from '@/components/ai-drive/GoalListCards'
import ReviewLinkPanel from '@/components/ai-drive/ReviewLinkPanel'

export const metadata = {
  title: 'AI自走 / Progress Dashboard',
}

// ====== モックデータ（v1）======
// 将来 Vault / progress API から動的に取得する想定。

const mainGoal: AIDriveGoal = {
  id: 'goal-mahjong-mvp',
  title: '麻雀アプリを広告収益化MVPへ進める',
  purpose: '公開可能なMVP品質まで改善し、広告収益化の準備を進める',
  status: 'needs_human_decision',
  monetizationImpact: 'high',
  nextAction: 'MVP改善 / 広告導線 / Vercel 公開確認の優先順位を承認',
  tools: ['claude_code', 'codex', 'chatgpt'],
  vaultReflectStatus: 'pending',
  currentStage: 'human_gate',
  decisionsNeeded: [
    'MVP 改善を優先するか',
    '広告導線を今回含めるか',
    'Vercel 公開確認まで進めるか',
  ],
}

const goals: AIDriveGoal[] = [
  mainGoal,
  {
    id: 'goal-scrape-lab',
    title: 'Scrape Labを市場調査自動蓄積ツールへ再設計',
    purpose: '市場調査の自動蓄積で、収益化候補の根拠データを継続生成する',
    status: 'planning',
    monetizationImpact: 'high',
    nextAction: '対象ソース・出力フォーマット・蓄積先 Vault パスの設計',
    tools: ['claude_code', 'codex'],
    vaultReflectStatus: 'not_yet',
    currentStage: 'plan',
  },
  {
    id: 'goal-ai-drive',
    title: 'Progress appにAI自走司令塔を追加',
    purpose: 'AI 自走を画面で安全に試せる司令塔をモックアップで先行公開',
    status: 'running',
    monetizationImpact: 'medium',
    nextAction: 'v1 モック実装 → ChatGPT レビュー → 本実装の Phase 分割',
    tools: ['claude_code', 'chatgpt'],
    vaultReflectStatus: 'pending',
    currentStage: 'execute',
  },
]

const humanApprovalGates: HumanApprovalGate[] = [
  { category: '主要設計の変更', policy: 'human_required', note: 'アーキテクチャ・モジュール分割・データ構造の変更' },
  { category: '使用技術 / 外部サービス選択', policy: 'human_required', note: '新規ライブラリ・SaaS の採用判断' },
  { category: 'DB 構造変更', policy: 'human_required', note: 'スキーマ追加・マイグレーション' },
  { category: '認証 / 課金 / API キー利用', policy: 'forbidden', note: 'AI からは触らない。必ず人間が操作' },
  { category: '本番公開 / Vercel / GitHub push', policy: 'human_required', note: 'デプロイ・公開コマンドは承認後に手動実行' },
  { category: '収益化方針変更', policy: 'human_required', note: '広告モデル / 価格 / 公開方針の変更' },
  { category: '軽量 UI 修正・ファイル整理', policy: 'ai_ok', note: '小規模リファクタ・コメント整理は AI 進行可' },
  { category: 'テスト / ビルド検証', policy: 'ai_ok', note: '検証実行は AI が継続' },
]

const promptCopyButtons: PromptCopyButton[] = [
  {
    id: 'situation',
    label: '現状把握プロンプトコピー',
    description: 'Vault + progress から現状サマリーを抽出するプロンプト',
    mockPromptText:
      '【現状把握】\n対象ゴール: 麻雀アプリを広告収益化MVPへ進める\n以下を Vault / progress から要約してください:\n- 現在の状態 / 進捗 / blockers\n- 直近の ExecutionRun と未レビュー件数\n- 残作業の優先順位\n出力: 5 行以内のサマリー。',
  },
  {
    id: 'plan',
    label: '計画作成プロンプトコピー',
    description: 'ゴール → 計画（フェーズ分割・依存関係・人間ゲート位置）',
    mockPromptText:
      '【計画作成】\n対象ゴール: 麻雀アプリを広告収益化MVPへ進める\n以下を出力:\n- 達成条件\n- フェーズ分割（最大 5）\n- 各フェーズの依存関係\n- 人間ゲート（承認必要箇所）\n- 仮の所要時間\n禁止: 認証 / 課金 / 公開 を AI 単独で進めない',
  },
  {
    id: 'claude-run',
    label: 'Claude自走プロンプトコピー',
    description: 'Claude Code が自走実行するためのプロンプト',
    mockPromptText:
      '【Claude 自走】\n対象ゴール: 麻雀アプリを広告収益化MVPへ進める\n承認済みフェーズのみ実行。\n停止条件:\n- 主要設計変更が必要 / 使用技術変更 / DB 変更\n- 認証 / 課金 / API キー利用\n- 本番公開 / push 直前\n出力: ExecutionRun POST + 完了マーカー 7 項目',
  },
  {
    id: 'codex-goal',
    label: 'Codex /goal コピー',
    description: 'Codex に渡す /goal 形式のゴール定義',
    mockPromptText:
      '/goal\nname: mahjong-monetize-mvp\npurpose: 公開可能なMVP品質まで改善し、広告収益化の準備を進める\nimpact: high\nconstraints:\n  - 認証/課金/APIキーを使用しない\n  - 本番公開は人間判断後\nnext: MVP 改善 → 広告導線 → Vercel 公開確認',
  },
  {
    id: 'chatgpt-review',
    label: 'ChatGPTレビュー用コピー',
    description: 'GitHub 経由でレビュー対象を指す依頼文',
    mockPromptText:
      '【ChatGPT レビュー依頼】\n対象: kaeru07/vault 直近 vloop\nレビュー対象: 20_reviews/_review_queue.md 未チェック先頭\nいつもの観点でレビューしてください:\n- 危険な変更がないか\n- 設計判断は妥当か\n- 次の一手は妥当か\n結論: approve / 修正後採用 / 差し戻し / 棚上げ',
  },
  {
    id: 'next-todo-json',
    label: '次ToDo JSON生成コピー',
    description: 'レビュー結果から progress 投入用 ToDo JSON を生成',
    mockPromptText:
      '【次 ToDo JSON 生成】\n直前 ExecutionRun: {{runId}}\n以下の JSON で出力:\n{\n  "targetApp": "...",\n  "targetTodoTitle": "...",\n  "firstAction": "...",\n  "doneCondition": "...",\n  "scenarioId": "candidate-XXX",\n  "vaultRef": "...",\n  "revenueImpact": "high|medium|low"\n}',
  },
  {
    id: 'vault-md',
    label: 'Vault保存用Markdownコピー',
    description: '本実行サイクルを Obsidian Vault に保存する Markdown',
    mockPromptText:
      '---\ndate: {{YYYY-MM-DD}}\ntask: {{タスク要約}}\nrunId: {{runId}}\ntargetApp: {{app}}\nmonetizationImpact: {{high|medium|low|none}}\ntheme: []\n---\n\n# {{タイトル}}\n\n## 作業目的\n\n## 実施内容\n\n## 検証結果\n\n## 次にやるべきこと\n\n## ChatGPT レビュー依頼文',
  },
]

const vaultPreview: VaultPreview = {
  sources: [
    { path: '00_inbox/AI自走_現在のゴール.md', purpose: '現在の最重要ゴールと判断材料', status: 'not_connected' },
    { path: '02_apps/progress.md', purpose: 'progress 自体の状態・残作業', status: 'not_connected' },
    { path: '03_prompts/AI自走運用ルール.md', purpose: 'AI 自走で守るべきルール / 停止条件', status: 'not_connected' },
    { path: '04_reviews/AI自走レビュー.md', purpose: 'ChatGPT レビュー履歴の長期記憶', status: 'not_connected' },
    { path: '05_monetization/収益化判断基準.md', purpose: '収益化 high/medium/low の判定基準', status: 'not_connected' },
  ],
  connectionStatus: 'not_connected',
  lastSync: '— モック —',
  reflectPending: 2,
  saveMarkdownReady: true,
}

const reviewLinks: ReviewLink[] = [
  { label: 'レビュー待ちを開く', href: '/logs', description: '未レビュー ExecutionRun 一覧へ' },
  { label: 'ExecutionRunを見る', href: '/logs', description: '実行履歴の一覧へ' },
  { label: '次ToDo候補を見る', href: '/tasks', description: 'ToDo / pending_approval へ' },
]

// ====== ページ本体 ======

export default function AIDrivePage() {
  const runningCount = goals.filter((g) => g.status === 'running').length
  const needsDecisionCount = goals.filter((g) => g.status === 'needs_human_decision').length
  const reviewWaitingCount = goals.filter((g) => g.status === 'review_waiting').length
  const vaultReflectPending = goals.filter((g) => g.vaultReflectStatus === 'pending').length
  const monetizationHighCount = goals.filter((g) => g.monetizationImpact === 'high').length

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      <Header
        runningCount={runningCount}
        needsDecisionCount={needsDecisionCount}
        reviewWaitingCount={reviewWaitingCount}
        vaultReflectPending={vaultReflectPending}
        monetizationHighCount={monetizationHighCount}
      />

      <MainGoalCard goal={mainGoal} />

      <StageFlow currentStage={mainGoal.currentStage ?? 'human_gate'} />

      <HumanApprovalGates gates={humanApprovalGates} />

      <PromptCopyButtons buttons={promptCopyButtons} />

      <VaultPreviewPanel preview={vaultPreview} />

      <GoalListCards goals={goals} />

      <ReviewLinkPanel links={reviewLinks} />

      <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
        v1 モックアップ / 本実装は未着手（API 連携 / Vault 自動書き込み / ExecutionRun 自動登録は次フェーズ）
      </p>
    </div>
  )
}
