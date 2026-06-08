import type { DecisionPolicy, EpicRiskFlag, EpicPriority, ExecutorType } from '@/lib/types/operations'

// おすすめ追加Epic: AI工場が Vault / Progress / 調査 / 既存Epic / 実行履歴を見て抽出した
// 「追加すべき Epic 候補」。ユーザーが承認した候補だけを epics.json へ追加する。
// 自動Epic追加は禁止（承認は人間のみ）。

export type RecommendationStatus = 'suggested' | 'approved' | 'rejected' | 'hold' | 'epic_created'

export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  'suggested',
  'approved',
  'rejected',
  'hold',
  'epic_created',
]

export type MonetizationImpact = 'high' | 'medium' | 'low' | 'none'

/** 新規 Epic として作るか、既存 Epic の Next Action 候補として扱うか。 */
export type RecommendationKind = 'new_epic' | 'existing_epic_next_action'

export interface RecHistoryEntry {
  at: string
  action: string
  detail?: string
}

export interface DuplicateCheck {
  duplicate: boolean
  reason?: string
}

export interface FactoryEligiblePreview {
  eligible: boolean
  reasons: string[]
  /** 表示区分（auto / approval / excluded）。未設定は後方互換で eligible から推定する。 */
  classification?: 'auto' | 'approval' | 'excluded'
  /** Factory 管理対象か（excluded 以外 true）。 */
  factoryManaged?: boolean
}

export interface RecommendedEpic {
  id: string
  status: RecommendationStatus
  kind: RecommendationKind
  title: string
  /** 推奨理由。 */
  reason: string
  monetizationImpact: MonetizationImpact
  /** 新規 Epic の対象アプリ slug。 */
  targetApp?: string
  /** existing_epic_next_action のとき、追記先の既存 Epic。 */
  relatedEpicId?: string
  relatedVault?: string[]
  relatedRunIds?: string[]
  priority: EpicPriority
  doneCriteria: string[]
  decisionPolicy: DecisionPolicy
  riskFlags: EpicRiskFlag[]
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  /** 抽出元の種別（monetization_candidate / stale_epic / factory_failure / next_action など）。 */
  sourceKind: string
  /** 抽出元の参照（candidate id / epic id / runId）。重複生成防止のキーにも使う。 */
  sourceRef?: string
  duplicate?: DuplicateCheck
  factoryEligiblePreview?: FactoryEligiblePreview
  /** 承認して作成した Epic の id（epic_created 後）。 */
  createdEpicId?: string
  notes?: string
  history?: RecHistoryEntry[]
  createdAt: string
  updatedAt: string
}

export interface ApproveRecommendationResult {
  ok: boolean
  reason?: string
  epicId?: string
  runId?: string
  /** existing_epic_next_action の場合、追記先 Epic。 */
  updatedEpicId?: string
}
