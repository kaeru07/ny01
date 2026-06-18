import fs from 'fs/promises'
import path from 'path'
import { readGoals } from '@/lib/goal-reader'
import { proposeGoals, type ProposeGoalInput, type ProposeGoalsResult } from '@/lib/goal-writer'

// 日々の調査結果（news-app の daily research）から「効果がありそう・やった方が良いこと」を抽出し、
// ゴール候補（status='proposed'）を作る。自動実行の最初とゴール達成時に呼び、Inboxで承認したものを自動実行する。
//
// 最も明確な「効果がありそう」シグナルは AIツール調査の「## 導入価値評価」セクション。
//   例: 「- OpenClaw: ★★★★☆ 即試したい。セルフホスト可で…」
// 星4以上を採用候補とし、「○○を試す/調査する」というゴールにする（例: Fableを試す）。

const RESEARCH_PATH =
  process.env.RESEARCH_CONTENT_PATH || path.join(process.cwd(), '..', 'news-app', 'content', 'research')

// 自動実行の最初に読む調査カテゴリ（導入価値評価を持つ AIツール調査を主とする）。
const CATEGORIES = ['daily-ai-tools'] as const

const MIN_STARS = 4

interface RawCandidate {
  name: string
  stars: number
  cue: string
  detail: string
  sourceDate: string
}

async function readFileSafe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8')
  } catch {
    return null
  }
}

/** カテゴリ配下の日付ファイル（YYYY-MM-DD.md）を新しい順で最大 days 件返す。 */
async function listRecentFiles(category: string, days: number): Promise<Array<{ date: string; path: string }>> {
  const dir = path.join(RESEARCH_PATH, category)
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  return names
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.md$/.test(n))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, days)
    .map((n) => ({ date: n.replace(/\.md$/, ''), path: path.join(dir, n) }))
}

/** 「## 導入価値評価」セクションの ★評価行をパースする。 */
function parseValueRatings(md: string, sourceDate: string): RawCandidate[] {
  const lines = md.split('\n')
  const out: RawCandidate[] = []
  let inSection = false
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = /導入価値評価/.test(line)
      continue
    }
    if (!inSection) continue
    // 例: - OpenClaw: ★★★★☆ 即試したい。セルフホスト可で…
    const m = line.match(/^\s*[-*]\s*(.+?)\s*[:：]\s*(★+)([☆]*)\s*(.+)$/)
    if (!m) continue
    const name = m[1].trim()
    const stars = m[2].length
    const rest = m[4].trim()
    // 先頭の一文を「キュー（即試したい/即調査/必須/PoC向き 等）」、残りを詳細にする。
    const split = rest.split(/[。．.]/)
    const cue = (split[0] ?? '').trim()
    const detail = rest
    if (stars >= MIN_STARS) {
      out.push({ name, stars, cue, detail, sourceDate })
    }
  }
  return out
}

/** キュー文言から動詞を選ぶ（調査寄り or 試す寄り）。 */
function actionVerb(cue: string): string {
  if (/調査|確認|比較|検討/.test(cue)) return '調査する'
  return '試す'
}

function toCandidate(raw: RawCandidate): ProposeGoalInput {
  const verb = actionVerb(raw.cue)
  return {
    title: `${raw.name}を${verb}`,
    summary: `日々の調査(AIツール ${raw.sourceDate})で高評価(${'★'.repeat(raw.stars)})。${raw.detail}`.slice(0, 200),
    metric: 'progress',
    target: 100,
    current: 0,
    priority: raw.stars >= 5 ? 'P0' : 'P1',
    rationale: `AIツール調査 ${raw.sourceDate} の導入価値評価で ${raw.stars}★（${raw.cue}）。効果が見込めるため検証ゴール化。`,
    source: 'research',
    enables: `${raw.name} を実際に使えるようになり、${raw.detail}`.slice(0, 200),
    pros: [
      `日々の調査で高評価（${raw.stars}★・${raw.cue}）＝効果が見込める`,
      '早く試すほど、他より先に自分の開発・運用へ取り込める',
    ],
    cons: [
      'まだ未検証（実際に試すまで効果・相性は不確実）',
      '導入・学習やセットアップの手間がかかる',
      raw.stars < 5 ? '最優先ではない（他の高優先タスクを圧迫しない範囲で）' : '最優先級だが、深入りしすぎないよう小さく検証する',
    ],
  }
}

/**
 * 日々の調査結果から高評価アイテムを抽出してゴール候補（ProposeGoalInput[]）を作る。
 * 既存ゴール（任意のstatus）と同名の候補は除外（承認済み/却下済みを蒸し返さない）。
 */
export async function buildResearchGoalCandidates(opts: { maxDays?: number; max?: number } = {}): Promise<ProposeGoalInput[]> {
  const maxDays = opts.maxDays ?? 3
  const max = opts.max ?? 3
  const raws: RawCandidate[] = []
  for (const category of CATEGORIES) {
    const files = await listRecentFiles(category, maxDays)
    for (const file of files) {
      const md = await readFileSafe(file.path)
      if (!md) continue
      raws.push(...parseValueRatings(md, file.date))
    }
  }
  // 同名（ツール名）の重複は最新・高評価を優先して1件に。
  const byName = new Map<string, RawCandidate>()
  for (const r of raws) {
    const prev = byName.get(r.name)
    if (!prev || r.stars > prev.stars || (r.stars === prev.stars && r.sourceDate > prev.sourceDate)) {
      byName.set(r.name, r)
    }
  }
  // 既存ゴール（全status）と同名タイトルは除外。
  const data = await readGoals()
  const existingTitles = new Set(data.goals.map((g) => g.title.trim()))
  const candidates = Array.from(byName.values())
    .sort((a, b) => b.stars - a.stars || b.sourceDate.localeCompare(a.sourceDate))
    .map(toCandidate)
    .filter((c) => !existingTitles.has(c.title.trim()))
  return candidates.slice(0, max)
}

/** 承認待ち(proposed)がこの件数以上なら新規提案しない（承認を促す）。 */
const MAX_PENDING_PROPOSALS = 3

export interface ResearchProposalResult {
  proposed: boolean
  reason: string
  created: ProposeGoalsResult['created']
  pendingCount: number
}

/**
 * 自動実行の最初・ゴール達成時に呼ぶ。承認待ちが上限未満なら、調査結果からゴール候補を提案登録する。
 * 承認待ちが上限以上なら提案しない（先にInboxで承認/却下を促す）。
 */
export async function proposeGoalsFromResearchIfNeeded(): Promise<ResearchProposalResult> {
  const data = await readGoals()
  const pending = data.goals.filter((g) => g.status === 'proposed').length
  if (pending >= MAX_PENDING_PROPOSALS) {
    return { proposed: false, reason: `承認待ちのゴール提案が${pending}件あるため新規提案しない`, created: [], pendingCount: pending }
  }
  const candidates = (await buildResearchGoalCandidates({ max: MAX_PENDING_PROPOSALS - pending }))
  if (candidates.length === 0) {
    return { proposed: false, reason: '調査結果から新規のゴール候補は見つからなかった', created: [], pendingCount: pending }
  }
  const result = await proposeGoals(candidates, { source: 'research' })
  return {
    proposed: result.created.length > 0,
    reason: `調査結果から${result.created.length}件のゴール候補を提案（承認後に自動実行対象）`,
    created: result.created,
    pendingCount: pending + result.created.length,
  }
}
