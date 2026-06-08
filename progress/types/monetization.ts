// Monetization Hub: AI工場が発掘した収益化候補を「発掘→調査→人間レビュー→Epic化承認→Factory実行」で
// 管理するためのデータ型。candidate は data/real/monetization-candidates.json に保存する。
// Epic化（Factory投入）は人間がボタンを押した時のみ。自動Epic化は禁止。

/** 候補の状態（発掘〜公開までのライフサイクル）。 */
export type CandidateStatus =
  | 'Draft'
  | 'Candidate'
  | 'Review'
  | 'Hold'
  | 'Approved'
  | 'Rejected'
  | 'EpicCreated'
  | 'Building'
  | 'Released'

export const CANDIDATE_STATUSES: CandidateStatus[] = [
  'Draft',
  'Candidate',
  'Review',
  'Hold',
  'Approved',
  'Rejected',
  'EpicCreated',
  'Building',
  'Released',
]

/** ブルーオーシャン判定（🟢 余地大 / 🟡 中 / 🔴 レッドオーシャン）。 */
export type BlueOcean = 'green' | 'yellow' | 'red'

/** 3段階の定性評価。 */
export type Level = 'high' | 'medium' | 'low'

/** スコア根拠（各軸 0〜100 の重み付け前の素点。合計は score に保持）。 */
export interface ScoreBreakdown {
  marketSize?: number
  monetization?: number
  retention?: number
  aso?: number
  overseas?: number
  devEase?: number
}

/** 収益化手段。 */
export interface MonetizationMethods {
  ads?: boolean
  subscription?: boolean
  oneTime?: boolean
  affiliate?: boolean
  note?: string
}

/** ブルーオーシャン判定の根拠。 */
export interface BlueOceanReason {
  competitorCount?: string
  competitorQuality?: string
  differentiation?: string
  barrier?: string
}

/** 「なぜ作るべきか」。 */
export interface WhyNow {
  summary?: string
  marketOpportunity?: string
  timing?: string
}

/** 競合 1 件。 */
export interface Competitor {
  name: string
  rating?: string
  downloads?: string
  strengths?: string
  weaknesses?: string
}

/** 調査履歴 1 件（時系列）。 */
export interface ResearchLog {
  date: string
  type: string
  note: string
  // ---- 定期取り込み拡張（任意・後方互換） ----
  summary?: string
  sourcePath?: string
  runId?: string
  impact?: 'score_up' | 'score_down' | 'no_change' | 'new_candidate'
}

/** 操作履歴 1 件（状態変更・Epic化などの監査ログ）。 */
export interface HistoryEntry {
  at: string
  action: string
  detail?: string
  // ---- 定期取り込み拡張（任意・後方互換） ----
  before?: string
  after?: string
  reason?: string
  runId?: string
  timestamp?: string
}

/** Vault 由来の調査元参照（根拠の所在）。 */
export type SourceRefType = 'vault' | 'review' | 'research' | 'daily' | 'manual' | 'factory'
export interface SourceRef {
  id: string
  type: SourceRefType
  path: string
  title?: string
  excerpt?: string
  section?: string
  keywords?: string[]
  signal?: string
  discoveredAt?: string
  addedByRunId?: string
  confidence?: 'high' | 'medium' | 'low'
}

/** 根拠リンク（Vault パスや外部 URL）。 */
export interface EvidenceLink {
  label: string
  path: string
  note?: string
}

/** 関連リンク。 */
export interface CandidateLinks {
  vault?: string
  researchNote?: string
  epicId?: string
  runId?: string
}

/** 収益化候補 1 件。 */
export interface MonetizationCandidate {
  id: string
  name: string
  category: string
  status: CandidateStatus
  /** 総合スコア（0〜100）。 */
  score: number
  scoreBreakdown?: ScoreBreakdown
  /** Epic化時の targetApp（英数スラッグ）。重複チェックにも使う。 */
  targetApp?: string

  // ---- 市場 ----
  marketSize?: string
  estimatedUsers?: string
  trendsRating?: string
  playStoreDemand?: string

  // ---- 検索需要 ----
  keywords?: string[]
  demand?: Level
  seoDifficulty?: Level

  // ---- 競合 / ブルーオーシャン ----
  competition?: Level
  blueOcean?: BlueOcean
  blueOceanReason?: BlueOceanReason
  competitors?: Competitor[]

  // ---- 評価サマリ ----
  expectedRevenue?: string
  devDifficulty?: Level
  overseas?: Level

  // ---- 内容 ----
  whyNow?: WhyNow
  problem?: string
  target?: string
  mvp?: string[]
  monetization?: MonetizationMethods

  // ---- メモ / 次アクション ----
  notes?: string
  nextAction?: string

  // ---- 履歴 / リンク ----
  researchLogs?: ResearchLog[]
  history?: HistoryEntry[]
  links?: CandidateLinks
  /** Vault 由来の調査元（根拠の所在）。定期取り込みで追記する。 */
  sourceRefs?: SourceRef[]
  /** 根拠リンク。 */
  evidenceLinks?: EvidenceLink[]
  /** 最新の市場シグナル（直近の調査で観測したもの）。 */
  latestSignal?: string

  // ---- 日付 / 取り込みメタ ----
  discoveredAt: string
  updatedAt: string
  lastResearchedAt?: string
  /** 最後に定期取り込みで更新した runId。 */
  lastSyncRunId?: string
  /** 定期取り込みでの新規追加日（手動追加と区別）。 */
  ingestedAt?: string
}

/** Epic化の結果。 */
export interface PromoteResult {
  ok: boolean
  reason?: string
  epicId?: string
  runId?: string
}
