import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'
import type { Goal } from '@/types/goal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 「試した方がいい系」(調査由来=research)の承認待ちゴールをトリアージする手動トリガ。
// - 特に試した方がよい（最優先=priority high＝★5）: 承認待ちのまま、notes に「特に試した方がいい理由」を追記。
// - あとででも良さそう（それ以外＝★4以下）: status を 'paused'（＝後で・保留）に変更し、承認待ちから外す。
// あわせて、過去に正規化で proposalSource が剥がれた研究系ゴールの source を 'research' に修復する。

// research 由来かどうかの判定（source が剥がれていてもタイトル/notes で拾う）。
function isResearchGoal(g: Goal): boolean {
  if (g.proposalSource === 'research') return true
  if (/を試す$|を調査する$/.test(g.title)) return true
  return /AIツール調査|導入価値評価/.test(g.notes ?? '')
}

function starsOf(g: Goal): number {
  const m = (g.notes ?? '').match(/(\d+)\s*★|(★+)/)
  if (m) {
    if (m[1]) return parseInt(m[1], 10)
    if (m[2]) return m[2].length
  }
  return g.priority === 'high' ? 5 : g.priority === 'low' ? 3 : 4
}

function cueOf(g: Goal): string {
  const m = (g.notes ?? '').match(/[（(]([^）)]{1,20})[）)]/)
  return m ? m[1] : ''
}

function buildReason(g: Goal): string {
  const stars = starsOf(g)
  const cue = cueOf(g)
  const tool = g.title.replace(/を(試す|調査する)$/, '')
  return `⭐特に試した方がいい: 調査で最高評価（★${stars}${cue ? `・${cue}` : ''}）。${tool}は今のClaude/Codex/MCP中心の開発・自動実行に直結し、早く試すほど自分の運用に取り込める。`
}

const REASON_MARK = '⭐特に試した方がいい'

export async function POST() {
  try {
    const data = await readGoals()
    const now = new Date().toISOString()
    let enriched = 0
    let movedLater = 0
    let repairedSource = 0

    for (const g of data.goals) {
      if (g.status !== 'proposed') continue
      if (!isResearchGoal(g)) continue
      if (g.proposalSource !== 'research') { g.proposalSource = 'research'; repairedSource += 1 }
      const stars = starsOf(g)
      if (stars >= 5 || g.priority === 'high') {
        // 特に試した方がいい → 承認待ち維持＋理由追記（重複追記しない）
        if (!(g.notes ?? '').includes(REASON_MARK)) {
          g.notes = `${buildReason(g)}${g.notes ? `\n${g.notes}` : ''}`
          g.updatedAt = now
          enriched += 1
        }
      } else {
        // あとででも良さそう → 後で（paused）に変更
        g.status = 'paused'
        g.updatedAt = now
        movedLater += 1
      }
    }

    await writeGoals(data)
    try {
      revalidatePath('/')
      revalidatePath('/decide')
    } catch (err) {
      console.warn('Failed to revalidate after triage:', err)
    }
    return NextResponse.json({ success: true, enriched, movedLater, repairedSource })
  } catch (err) {
    console.error('Failed to triage research goals:', err)
    return NextResponse.json({ success: false, error: 'failed to triage research goals' }, { status: 500 })
  }
}
