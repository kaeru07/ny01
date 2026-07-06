export interface KnowledgeRecord {
  id: string
  sourceRunId: string
  sourceEpicId?: string
  goalId?: string
  title: string
  summary: string
  learnings: string[]
  nextActions: string[]
  changedFiles: string[]
  vaultReviewPath: string
  researchPath: string
  decisionLogPath: string
  nextEpicCandidateId?: string
  createdAt: string
  updatedAt: string
}

export interface KnowledgeLoopResult {
  knowledge: KnowledgeRecord
  recommendationId: string
  createdKnowledge: boolean
  createdRecommendation: boolean
}

/** Execution→Review→Knowledge→Next Epic ループの各段でこぼれた1件。 */
export interface LoopClosureGap {
  kind: 'reviewed_without_knowledge' | 'knowledge_without_next_epic' | 'needs_followup_without_recommendation'
  runId?: string
  knowledgeId?: string
  detail: string
}

/** ループの段ごとの件数（閉じ具合の可視化用）。 */
export interface LoopStageStat {
  reviewedRuns: number
  knowledgeRecords: number
  knowledgeWithNextEpic: number
  needsFollowupRuns: number
  followupRecommendations: number
  reviewKnowledgeRecommendations: number
}

/**
 * ループの最終リンク（Next Epic候補 → Epic化/トリアージ）の受け渡し状況。
 * Knowledge から候補を生成するところまでは gaps=0 でも閉じるが、
 * 候補が suggested のまま滞留すると候補が次の実行へ戻らず、ループは実務上閉じない。
 * この段は「人間トリアージ待ち（pendingTriage）」を可視化するためのもので、
 * 自己修復で解消できる『こぼれ(gap)』とは区別する（closed 判定には含めない）。
 */
export interface LoopHandoffStat {
  /** レビュー起点で生成された候補の総数（review_knowledge + review_followup）。 */
  reviewCandidatesTotal: number
  /** トリアージ済み（suggested 以外＝approved/rejected/hold/epic_created/expired）。 */
  reviewCandidatesActedOn: number
  /** Epic化済み（status: epic_created）。 */
  reviewCandidatesPromoted: number
  /** 未トリアージで滞留中（status: suggested）。次の実行へ戻っていない候補。 */
  reviewCandidatesPendingTriage: number
  /** 受け渡し率 0..100（小数1桁）。actedOn / total。 */
  handoffRatePct: number
  /** 滞留を解消するための人間向け次アクション（人間語）。 */
  nextAction: string
  /**
   * 未トリアージで滞留中の候補のうち、次に着手すべき上位（priority→新しい順, 最大5件）。
   * ループ最終リンク（候補→次の実行）を「件数の指標」から「具体的に着手できる導線」に変えるための要約。
   */
  topPendingCandidates: LoopPendingCandidate[]
  /**
   * 重複排除後の「実際に区別すべき滞留 issue 数」。
   * 同一案件（targetApp + 正規化タイトル / 親Epic）への修正依頼は run ごとに別候補として生成されるため、
   * 生件数（pendingTriage）はトリアージ負荷を過大に見せる。1 issue = 1 トリアージ判断に集約した数。
   */
  distinctPendingIssues: number
  /**
   * 滞留候補を案件単位にまとめた上位グループ（重複件数の多い順, 最大5件）。
   * 「205 件をどう捌くか」を「同じ案件の N 件をまとめて1回判断する」へ変えるための導線。
   */
  consolidatedPending: LoopPendingGroup[]
}

/** 同一案件にまとまった滞留候補グループ（重複 followup を1判断単位に集約したもの）。 */
export interface LoopPendingGroup {
  /** グルーピングキー（targetApp + 正規化タイトル / 親Epic から導出）。 */
  groupKey: string
  /** 代表タイトル（グループ内で最新の候補のタイトル）。 */
  title: string
  /** グループ内最高 priority（'P0' | 'P1' | 'P2'）。 */
  priority: string
  targetApp?: string
  sourceKind: string
  /** このグループに属する滞留候補の件数（重複を含む実件数）。 */
  count: number
  /** 代表候補 id（最新・最高 priority の1件）。トリアージ着手の入口。 */
  representativeId: string
  /** グループ内の候補 id 一覧（まとめて status 変更する際に使える）。 */
  candidateIds: string[]
  /** グループ内で最も新しい updatedAt。 */
  latestUpdatedAt?: string
}

/** 滞留中の次Epic候補1件の要約（人間が次の実行へ戻す判断に必要な最小情報）。 */
export interface LoopPendingCandidate {
  id: string
  title: string
  /** 'P0' | 'P1' | 'P2'。 */
  priority: string
  targetApp?: string
  /** 'review_knowledge'（レビュー学び起点） | 'review_followup'（修正依頼起点）。 */
  sourceKind: string
  /** 起点の ExecutionRun。候補の出所を辿るため。 */
  sourceRunId?: string
  updatedAt?: string
}

/**
 * closedLoopRate（実測の閉ループ率）と、まだ閉じていない Run の内訳。
 * gaps（=こぼれ）が 0 でも closedLoopRate は 100% にならない点を説明するための指標。
 * 分母・分子は factory-metrics の closedLoopRate と同じ定義に揃える。
 */
export interface LoopMetricBreakdown {
  /** 0..1。factory-metrics の closedLoopRate と同義。 */
  closedLoopRate: number
  /** 0..100（小数1桁）。Goal closed_loop_rate の current と同義。 */
  closedLoopRatePct: number
  /** 分母: runStatus !== 'running' の Run 数。 */
  countableRuns: number
  /** 分子: Knowledge が紐づく（=閉じた）Run 数。 */
  closedLoopRuns: number
  /** まだ閉じていない Run 数（countableRuns - closedLoopRuns）。 */
  openLoopRuns: number
  /** まだ閉じていない理由別の内訳。合計 = openLoopRuns。 */
  openBreakdown: {
    /** 一次レビュー待ち（not_reviewed / 未設定）。 */
    awaitingFirstReview: number
    /** 人間判断待ち（needs_human）。 */
    blockedOnHuman: number
    /** 修正依頼（needs_followup）。修正候補は出るが Knowledge 化は修正Runのレビュー後。 */
    awaitingFix: number
    /** 上記以外（reviewed なのに Knowledge 未生成＝自己修復で閉じられるこぼれ等）。 */
    other: number
  }
  /** 率を上げるために人間が取るべき次アクション（人間語）。 */
  nextActionsToRaise: string[]
}

/**
 * 参照整合（Knowledge.nextEpicCandidateId → recommended-epics）の健全性。
 * gaps とは別枠で扱う理由: リンク切れは backfill（自己修復）で再生成できない
 * （早期returnで既存扱いされるため）。gaps/closed に混ぜると「こぼれ」や閉ループ率を
 * 汚し、かつ heal ボタンで消せない gap が常駐してしまう。件数の可視化のみを行い、
 * 再生成は人間判断とする（自動 heal に含めない）。
 */
export interface LoopReferenceIntegrity {
  /** nextEpicCandidateId が recommended-epics に存在しない Knowledge の件数（リンク切れ）。 */
  brokenNextEpicCandidates: number
  /** リンク切れした Knowledge の id（先頭最大50件・調査用）。 */
  brokenKnowledgeIds: string[]
}

/** ループが閉じているか（reviewed→Knowledge→Next Epic候補 / needs_followup→修正候補）の健全性レポート。 */
export interface LoopClosureReport {
  closed: boolean
  generatedAt: string
  reviewStatusCounts: Record<string, number>
  stage: LoopStageStat
  /** closedLoopRate（実測の閉ループ率）と未クローズ Run の内訳。 */
  metric: LoopMetricBreakdown
  /** ループ最終リンク（候補→Epic化/トリアージ）の受け渡し状況。 */
  handoff: LoopHandoffStat
  gaps: LoopClosureGap[]
  gapCount: number
  /** 参照整合（Next Epic候補のリンク切れ）の可視化。closed/gaps 判定には含めない。 */
  referenceIntegrity: LoopReferenceIntegrity
}

/** heal（既存 backfill による自己修復）の前後比較。 */
export interface LoopHealResult {
  before: LoopClosureReport
  after: LoopClosureReport
  healed: number
  createdKnowledgeRecommendations: number
  createdFollowupRecommendations: number
}
