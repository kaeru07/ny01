import { readJson } from './store'

// app-factory-candidates: アプリ開発工場（epic-a5r7n4）の候補キュー読み取り専用ビュー。
// 各アプリ案の 目的 / 収益化仮説 / 優先度 / 次アクション を一覧で確認できるようにする。
// 副作用なし（読むだけ）。Factory ロジック・安全ゲートには一切触らない。

export type CandidatePriority = 'high' | 'medium' | 'low'

/** 候補キューの 1 アプリ案。 */
export interface AppFactoryCandidate {
  id: string
  title: string
  /** 対応する app-progress.json の project id（無ければ null）。 */
  sourceProjectId: string | null
  /** 目的。 */
  purpose: string
  /** 収益化仮説。 */
  monetizationHypothesis: string
  /** 優先度。 */
  priority: CandidatePriority
  /** キュー上の状態（ready_to_ship / deploy_ready / in_progress / confirmed / active など）。 */
  status: string
  /** 次アクション。 */
  nextAction: string
  /** Factory（Claude/Codex）が安全に着手できる範囲か。 */
  factorySafe: boolean
  /** Factory 着手時の注意（公開・deploy はユーザー操作など）。 */
  factoryNote?: string
}

export interface AppFactoryCandidateQueue {
  epicId: string
  description: string
  candidates: AppFactoryCandidate[]
  updatedAt: string
}

const EMPTY: AppFactoryCandidateQueue = {
  epicId: 'epic-a5r7n4',
  description: '',
  candidates: [],
  updatedAt: '',
}

const PRIORITY_ORDER: Record<CandidatePriority, number> = { high: 0, medium: 1, low: 2 }

/** 候補キューを読み込み、優先度（high→low）順に整列して返す。 */
export async function getAppFactoryCandidates(): Promise<AppFactoryCandidateQueue> {
  const queue = await readJson<AppFactoryCandidateQueue>('app-factory-candidates.json', EMPTY)
  const candidates = [...(queue.candidates ?? [])].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  )
  return { ...queue, candidates }
}
