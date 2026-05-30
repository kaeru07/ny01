// AI自走画面（/ai-drive）モックアップ用の型定義
// v1 ではモックデータのみで使用。将来 Vault 連携で実データを流し込む前提。

export type AIDriveStatus =
  | 'draft'
  | 'planning'
  | 'needs_human_decision'
  | 'approved'
  | 'running'
  | 'review_waiting'
  | 'reviewed'
  | 'next_loop'
  | 'blocked'

export type MonetizationImpact = 'high' | 'medium' | 'low' | 'none'

export type AIDriveStage =
  | 'goal'
  | 'plan'
  | 'human_gate'
  | 'execute'
  | 'execution_run'
  | 'review'
  | 'next_loop'

export type AIDriveTool = 'claude_code' | 'codex' | 'chatgpt' | 'manual'

export type ApprovalPolicy = 'ai_ok' | 'human_required' | 'forbidden'

export interface AIDriveGoal {
  id: string
  title: string
  purpose: string
  status: AIDriveStatus
  monetizationImpact: MonetizationImpact
  nextAction: string
  tools: AIDriveTool[]
  vaultReflectStatus: 'pending' | 'synced' | 'not_yet' | 'n/a'
  decisionsNeeded?: string[]
  currentStage?: AIDriveStage
}

export interface HumanApprovalGate {
  category: string
  policy: ApprovalPolicy
  note?: string
}

export interface PromptCopyButton {
  id: string
  label: string
  description: string
  // モック用のプロンプト本文（将来 Vault / API から生成する想定）
  mockPromptText: string
}

export interface VaultSource {
  path: string
  purpose: string
  status: 'not_connected' | 'mock' | 'synced'
}

export interface VaultPreview {
  sources: VaultSource[]
  connectionStatus: 'not_connected' | 'mock' | 'synced'
  lastSync: string
  reflectPending: number
  saveMarkdownReady: boolean
}

export interface ReviewLink {
  label: string
  href: string
  description: string
}
