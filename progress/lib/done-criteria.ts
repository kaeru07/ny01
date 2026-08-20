import { readJson } from './store'
import { getEpic, getPendingApprovals } from './operations-store'
import type { ExecutionRunsData, ExecutionRun } from '@/types/execution-run'

// doneCriteria 自動判定エンジン（executor 非依存 / Claude・Codex 共通）。
// 新しい正本は作らない: Epic Contract（doneCriteria）と ExecutionRun（checks/changedFiles/summary/
// rawReport/nextActions/executorUsed）から判定する。
//
// 判定レイヤー:
//   L1 機械判定: build / typecheck / lint を ExecutionRun.checks で判定。
//   L2 ファイル変更: changedFiles に対象が含まれるか。
//   L3 曖昧一致: summary / rawReport と criterion 文字列の bigram 重なり。
//   meta: ExecutionRun 記録の有無 / 未承認作業の有無。
//   L4 全達成→done / L5 一部未達→continue。

export type DoneVerdict = 'done' | 'continue'
export type CriterionLevel = 'L1' | 'L2' | 'L3' | 'meta'

export interface CriterionResult {
  text: string
  met: boolean
  level: CriterionLevel
  evidence: string
}

export interface DoneCriteriaEvaluation {
  epicId: string
  hasContract: boolean
  verdict: DoneVerdict
  metCount: number
  total: number
  ratio: string
  criteria: CriterionResult[]
  evaluatedAt: string
}

interface EvalContext {
  checks: Record<string, string>
  changedFiles: string[]
  summary: string
  rawReport: string
  runCount: number
  hasExecutor: boolean
  pendingApprovalCount: number
}

function isOk(v?: string): boolean {
  return !!v && /(^|[^n])ok|pass|成功|✓|true/i.test(v)
}

function bigrams(s: string): string[] {
  const clean = s.toLowerCase().replace(/[\s、。,.\-_/]+/g, '')
  const out: string[] = []
  for (let i = 0; i < clean.length - 1; i++) out.push(clean.slice(i, i + 2))
  return out
}

function overlapRatio(a: string, b: string): number {
  const ba = bigrams(a)
  if (ba.length === 0) return 0
  const sb = new Set(bigrams(b))
  const hit = ba.filter((g) => sb.has(g)).length
  return hit / ba.length
}

function evidenceTextFor(criterion: string, ctx: EvalContext): string {
  const source = `${ctx.summary} ${ctx.rawReport} ${ctx.changedFiles.join(' ')}`
  return source
    .replaceAll(criterion, ' ')
    .replaceAll(criterion.replace(/\s+/g, ''), ' ')
}

function isResearchCriterion(text: string): boolean {
  return /調査|確認|検証|レビュー|棚卸|洗い出|分析|比較|整理|報告|レポート|結果|特定|記録|一覧|サマリ|まとめ/.test(text)
}

function isImplementationCriterion(text: string): boolean {
  return /変更|修正|追加|実装|作成|画面|ファイル|対応|削除|導入|API|UI|コンポーネント|設定/.test(text)
}

function hasResearchEvidence(text: string): boolean {
  return /調査結果|確認結果|検証結果|レビュー結果|棚卸し結果|分析結果|比較結果|報告|レポート|結論|判明|特定|一覧|対象|確認済み|未確認|所見|根拠/.test(text)
}

function evalCriterion(text: string, ctx: EvalContext): CriterionResult {
  const t = text.toLowerCase()
  const mentionsBuild = /build|ビルド/.test(t)
  const mentionsTs = /typecheck|typescript|tsc|型チェック|型検査/.test(t)
  const mentionsLint = /lint|リント/.test(t)

  // L1 機械判定（build / typecheck / lint）。「または」を含むため、言及した中の 1 つでも OK なら met。
  if (mentionsBuild || mentionsTs || mentionsLint) {
    const oks: string[] = []
    if (mentionsBuild && isOk(ctx.checks.build)) oks.push('build')
    if (mentionsTs && isOk(ctx.checks.typescript)) oks.push('typescript')
    if (mentionsLint && isOk(ctx.checks.lint)) oks.push('lint')
    const met = oks.length > 0
    return {
      text,
      met,
      level: 'L1',
      evidence: met
        ? `checks OK: ${oks.join(', ')}`
        : `checks未OK（build=${ctx.checks.build ?? '-'} / ts=${ctx.checks.typescript ?? '-'} / lint=${ctx.checks.lint ?? '-'}）`,
    }
  }

  // meta: ExecutionRun 記録
  if (/executionrun|実行履歴|実行結果.*記録|結果.*記録|記録されている/.test(t)) {
    const met = ctx.runCount > 0 && ctx.hasExecutor
    return { text, met, level: 'meta', evidence: met ? `ExecutionRun ${ctx.runCount}件 / executorUsed 有` : 'ExecutionRun なし' }
  }

  // meta: 未承認作業が発生していない
  if (/未承認|承認待ち.*発生|追加.*作業.*ない|未承認.*ない/.test(t)) {
    const met = ctx.pendingApprovalCount === 0
    return { text, met, level: 'meta', evidence: met ? '承認待ちなし' : `承認待ち ${ctx.pendingApprovalCount} 件` }
  }

  // meta: goal-step Epic の「次の一歩を定義する」は計画文言だが、実際にはその一歩を
  // executor 付きで実行して成果を残した時点で達成とする。「検証可能」を含むため、
  // 調査 criterion と誤判定される前にここで捕捉する。
  if ((/次の.*(具体的|検証可能).*(1|一).?ステップ.*定義/.test(text) || /次の一歩/.test(text)) && /定義/.test(text)) {
    const hasOutcome = ctx.changedFiles.length > 0 || hasResearchEvidence(ctx.summary)
    const met = ctx.runCount > 0 && ctx.hasExecutor && hasOutcome
    return {
      text,
      met,
      level: 'meta',
      evidence: met
        ? `ExecutionRun ${ctx.runCount}件 / executorUsed 有 / 成果あり`
        : `未達（ExecutionRun ${ctx.runCount}件 / executorUsed ${ctx.hasExecutor ? '有' : '無'} / 成果${hasOutcome ? 'あり' : 'なし'}）`,
    }
  }

  const evidenceText = evidenceTextFor(text, ctx)
  const ratioText = overlapRatio(text, evidenceText)

  // 調査・確認・レビュー系: changedFiles が無い実行でも、結果・所見・対象ファイル等の証跡があれば達成できる。
  // criteria 文言を rawReport にそのまま貼っただけの自己引用は evidenceTextFor で除外する。
  if (isResearchCriterion(text)) {
    const hayFiles = ctx.changedFiles.join(' ')
    const ratioFiles = overlapRatio(text, hayFiles)
    const reportArtifact = /\.(md|markdown|txt|json|csv|ndjson)$/i.test(hayFiles) || /docs\/|reviews\/|reports?\//i.test(hayFiles)
    const reportEvidence = hasResearchEvidence(evidenceText)
    const met = (reportArtifact && (ratioFiles >= 0.18 || ctx.changedFiles.length > 0)) || (reportEvidence && ratioText >= 0.12)
    return {
      text,
      met,
      level: reportArtifact ? 'L2' : 'L3',
      evidence: met
        ? `${reportArtifact ? `調査成果ファイル ${ctx.changedFiles.length}件` : '調査結果の記録あり'} / 一致率 text=${ratioText.toFixed(2)} files=${ratioFiles.toFixed(2)}`
        : `未達（調査結果証跡=${reportEvidence ? 'あり' : 'なし'} / changedFiles ${ctx.changedFiles.length}件 / 一致率 text=${ratioText.toFixed(2)} files=${ratioFiles.toFixed(2)}）`,
    }
  }

  // L2/L3: ファイル変更・機能実装・文言修正など
  if (isImplementationCriterion(text)) {
    const onlyOne = /1\s*箇所|一箇所|1\s*ファイル|1つ/.test(t)
    const fileChanged = ctx.changedFiles.length > 0
    const hayFiles = ctx.changedFiles.join(' ')
    const ratioFiles = overlapRatio(text, hayFiles)
    const tokenHit = ratioText >= 0.18 || ratioFiles >= 0.25
    const level: CriterionLevel = ratioFiles >= 0.25 ? 'L2' : 'L3'
    let met = fileChanged && tokenHit
    if (onlyOne) met = met && ctx.changedFiles.length === 1
    return {
      text,
      met,
      level,
      evidence: met
        ? `changedFiles ${ctx.changedFiles.length}件${tokenHit ? ' / 語一致' : ''}${onlyOne ? ' / 1件のみ' : ''}`
        : `未達（changedFiles ${ctx.changedFiles.length}件 / 一致率 text=${ratioText.toFixed(2)} files=${ratioFiles.toFixed(2)}）`,
    }
  }

  // L3 汎用曖昧一致
  const met = ratioText >= 0.3 && (ctx.changedFiles.length > 0 || hasResearchEvidence(evidenceText))
  return { text, met, level: 'L3', evidence: met ? `要約一致 ${ratioText.toFixed(2)}` : `一致不足 ${ratioText.toFixed(2)}` }
}

/** 最新優先で checks をマージ（各キーを持つ最も新しい run の値）。 */
function mergeChecks(runs: ExecutionRun[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of runs) {
    for (const [k, v] of Object.entries(r.checks ?? {})) {
      if (v && out[k] === undefined) out[k] = v
    }
  }
  return out
}

/** Epic とその ExecutionRun 群から doneCriteria を評価する純粋関数。 */
export function evaluateDoneCriteria(
  epicId: string,
  doneCriteria: string[] | undefined,
  runs: ExecutionRun[],
  pendingApprovalCount: number,
): DoneCriteriaEvaluation {
  const now = new Date().toISOString()
  const sorted = [...runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  const ctx: EvalContext = {
    checks: mergeChecks(sorted),
    changedFiles: Array.from(new Set(sorted.flatMap((r) => (r.changedFiles ?? []).map((f) => f.file)))),
    summary: sorted.slice(0, 5).map((r) => r.summary).join(' \n '),
    rawReport: sorted.slice(0, 3).map((r) => r.rawReport ?? '').join(' \n ').slice(0, 6000),
    runCount: sorted.length,
    hasExecutor: sorted.some((r) => Boolean(r.executorUsed)),
    pendingApprovalCount,
  }

  if (!doneCriteria || doneCriteria.length === 0) {
    return { epicId, hasContract: false, verdict: 'continue', metCount: 0, total: 0, ratio: '0/0', criteria: [], evaluatedAt: now }
  }

  const criteria = doneCriteria.map((c) => evalCriterion(c, ctx))
  const metCount = criteria.filter((c) => c.met).length
  const total = criteria.length
  const verdict: DoneVerdict = metCount === total ? 'done' : 'continue'
  return { epicId, hasContract: true, verdict, metCount, total, ratio: `${metCount}/${total}`, criteria, evaluatedAt: now }
}

/** Epic の doneCriteria を、その Epic の ExecutionRun から評価する（API/UI/runner 共通入口）。 */
export async function getDoneCriteriaForEpic(epicId: string): Promise<DoneCriteriaEvaluation | null> {
  const epic = await getEpic(epicId)
  if (!epic) return null
  const runsData = await readJson<ExecutionRunsData>('execution-runs.json', { runs: [] })
  const runs = runsData.runs.filter((r) => r.epicId === epicId)
  const pending = await getPendingApprovals()
  const pendingApprovalCount = pending.filter((a) => a.epicId === epicId).length
  return evaluateDoneCriteria(epicId, epic.doneCriteria, runs, pendingApprovalCount)
}
