import { scanFactoryDispatch } from '@/lib/factory-dispatch'
import { getFactoryScheduleStatus } from '@/lib/factory-schedule-status'
import { humanizeTitle, subjectOf, shorten } from '@/lib/humanize'
import { readPageEpics, readPageExecutionRuns, readPageRecommendations } from '@/lib/page-data-cache'
import type { ExecutionRun } from '@/types/execution-run'

// AI工場の「計器盤」ビューモデル（第1波・2026-06-12）。
// 司令塔ホームに出す Now/Next/Later・稼働サマリー・修正依頼中・前回結果の人間語化をここで組み立てる。
// 新しい正本は作らない（既存の runs / epics / dispatch scan からの都度算出）。
// 内部語（runId / ExecutionRun / max_runs_reached 等）はこのモジュールの出口で必ず人間語に変換する。

export interface FactoryOutlook {
  /** いま: 実行中の作業 or 待機中の説明文 */
  nowText: string
  /** 次: 次回Factory起動時に最初に進める見込みの作業（人間語） */
  nextText: string | null
  /** その次 */
  laterText: string | null
  /** 待機件数（Next/その次に入らなかった実行可能Epic + 承認待ちのEpic候補） */
  waitingCount: number
  /** 注記: 予定は保証しない */
  note: string
  /** 前回: 直近の自動/AI作業サマリー */
  previousText: string
  /** 次回自動実行: スケジューラ上の次回予定 */
  nextRunText: string
}

export interface FixRequestView {
  count: number
  /** 閉ループ状態（最大5件） */
  items: Array<{
    title: string
    stage: 'AI修正中' | '再確認待ち' | '検収'
    detail: string
  }>
}

const RUNNING_STALE_MS = 30 * 60 * 1000

/** Epicタイトルを「〜を進めます/〜を調査します」の予定文に変換する。 */
function planPhrase(title: string): string {
  const clean = humanizeTitle(title)
  const subject = shorten(subjectOf(clean), 30)
  if (/(停止|止ま|失敗|エラー|不具合|障害)/.test(clean)) return `${subject}を調査します`
  if (/(調査|分析|リサーチ)/.test(clean)) return `${subject}を調査します`
  return `${subject}を進めます`
}

/** Now / Next / Later。Factoryの選定順（priority順）を「次回起動時の予定」として見せる。 */
export async function buildFactoryOutlook(): Promise<FactoryOutlook> {
  const note = 'これは次回の自動実行時の予定です。状況により順番は変わります。'
  try {
    const [runs, scan, epics, recommendations, previousText, schedule] = await Promise.all([
      readPageExecutionRuns(),
      scanFactoryDispatch(),
      readPageEpics(),
      readPageRecommendations(),
      buildWorkSummary(),
      getFactoryScheduleStatus(),
    ])
    const nextRunText = formatNextRun(schedule.nextRunAt, schedule.dailyTime)

    // いま: running の作業があればそれ。なければ待機中
    const running = runs.find((r) => r.runStatus === 'running' && !isStaleRunning(r))
    const nowText = running
      ? `「${shorten(subjectOf(humanizeTitle(running.targetTodoTitle || running.summary || '')), 30) || 'AIの作業'}」を作業中です。`
      : '待機中。次回の自動実行を待っています。'

    if (!scan.factoryEnabled) {
      return { nowText: 'AI工場はオフになっています。', nextText: null, laterText: null, waitingCount: 0, note, previousText, nextRunText }
    }

    // 次/その次: Goal未設定を除いた選定順（priority順）の先頭2件
    const goalUnset = new Set(epics.filter((e) => ['approved', 'active'].includes(e.status) && !e.goalId).map((e) => e.epicId))
    const queue = scan.candidates.filter((p) => !goalUnset.has(p.epicId))
    const nextText = queue[0] ? planPhrase(queue[0].epicTitle) : null
    const laterText = queue[1] ? planPhrase(queue[1].epicTitle) : null
    // 待機 = 選定順の3番目以降 + 許可待ちの作業候補（承認されると列に並ぶ）
    const suggestedCount = recommendations.filter((r) => r.status === 'suggested').length
    const waitingCount = Math.max(queue.length - 2, 0) + suggestedCount

    return { nowText, nextText, laterText, waitingCount, note, previousText, nextRunText }
  } catch {
    return {
      nowText: '次回予定を整理中',
      nextText: null,
      laterText: null,
      waitingCount: 0,
      note,
      previousText: '前回の作業を整理中',
      nextRunText: '次回自動実行を確認中',
    }
  }
}

function formatNextRun(nextRunAt: string | null, dailyTime: string | null): string {
  if (!nextRunAt) {
    return dailyTime ? `${dailyTime}予定（timer未有効）` : '未設定'
  }
  const d = new Date(nextRunAt)
  if (Number.isNaN(d.getTime())) return nextRunAt
  const today = ymdOf(new Date().toISOString())
  const tomorrow = ymdOf(new Date(Date.now() + 86_400_000).toISOString())
  const day = ymdOf(nextRunAt)
  const dayLabel = day === today ? '本日' : day === tomorrow ? '明日' : d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  return `${dayLabel}${d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}予定`
}

function ymdOf(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function isStaleRunning(run: ExecutionRun): boolean {
  const started = Date.parse(run.startedAt)
  if (!Number.isFinite(started)) return true
  return Date.now() - started > RUNNING_STALE_MS
}

const ROUTINE_RUN = /Factory schedule|定期取り込み/

/** アプリ内部名 → 表示名（最低限）。 */
function appLabel(app: string): string {
  if (!app) return ''
  if (app === 'progress') return 'Progress'
  if (/birdlog/i.test(app)) return 'BirdLog'
  if (/news/i.test(app)) return 'ニュースアプリ'
  if (/mahjong/i.test(app)) return '麻雀アプリ'
  if (/shogi/i.test(app)) return '将棋アプリ'
  return app
}

/**
 * 昨日（なければ直近に作業があった日）の稼働を1〜2行の人間語で要約する。
 * 完璧な精度より「AIが働いている感」を優先する（定期処理は件数から除外）。
 */
export async function buildWorkSummary(): Promise<string> {
  const runs = await readPageExecutionRuns()
  const worked = runs.filter((r) => !ROUTINE_RUN.test(r.targetTodoTitle || ''))
  if (worked.length === 0) return 'まだAIの作業履歴がありません。'

  const today = ymdOf(new Date().toISOString())
  const byDay = new Map<string, ExecutionRun[]>()
  for (const r of worked) {
    const d = ymdOf(r.startedAt)
    if (!d || d === today) continue
    byDay.set(d, [...(byDay.get(d) ?? []), r])
  }
  const days = Array.from(byDay.keys()).sort().reverse()
  if (days.length === 0) return '今日はここまでに目立った自動作業はありません。'

  const day = days[0]
  const dayRuns = byDay.get(day)!
  const ok = dayRuns.filter((r) => r.runStatus === 'completed').length
  const yesterday = ymdOf(new Date(Date.now() - 86_400_000).toISOString())
  const dayLabel = day === yesterday ? '昨日' : `前回（${day.slice(5).replace('-', '/')}）`

  // 一番動いたアプリを「◯◯が進みました」として添える
  const byApp = new Map<string, number>()
  for (const r of dayRuns) byApp.set(r.targetApp, (byApp.get(r.targetApp) ?? 0) + 1)
  const top = Array.from(byApp.entries()).sort((a, b) => b[1] - a[1])[0]
  const progressed = top && top[1] > 0 ? ` ${appLabel(top[0])}が${top[1]}歩進みました。` : ''

  return `${dayLabel}は${dayRuns.length}件処理し、${ok}件成功しました。${progressed}`
}

/** 修正依頼中（「修正する」を押したもの）の見える化。 */
export async function buildFixRequests(): Promise<FixRequestView> {
  const [runs, recommendations] = await Promise.all([
    readPageExecutionRuns(),
    readPageRecommendations(),
  ])
  const fixing = runs.filter((r) => r.reviewStatus === 'needs_followup')
  return {
    count: fixing.length,
    items: fixing
      .slice(0, 5)
      .map((r) => {
        const title = shorten(subjectOf(humanizeTitle(r.targetTodoTitle || r.summary || '')), 24) || '作業'
        const linkedRun = runs.find((x) => x.followupOfRunId === r.runId && x.source !== 'recommended_epics')
        const fallbackLaterRun = runs.find((x) =>
          !linkedRun &&
          x.runId !== r.runId &&
          (x.epicId && r.epicId ? x.epicId === r.epicId : x.targetApp === r.targetApp) &&
          new Date(x.startedAt).getTime() > new Date(r.finishedAt || r.startedAt).getTime(),
        )
        const laterRun = linkedRun ?? fallbackLaterRun
        const hasFollowupCandidate = recommendations.some((rec) => rec.followupOfRunId === r.runId || rec.sourceRunId === r.runId)
        const stage = laterRun
          ? laterRun.reviewStatus === 'reviewed'
            ? '検収'
            : '再確認待ち'
          : hasFollowupCandidate
            ? 'AI修正中'
            : 'AI修正中'
        const detail =
          stage === 'AI修正中'
            ? '修正依頼をAIの次作業候補に回しています'
            : stage === '再確認待ち'
              ? 'AIの修正結果を確認できます'
              : '修正結果は確認済みです'
        return { title, stage, detail }
      }),
  }
}

/** 前回の自動実行結果を人間語に変換する（runId / 内部ステータスを出さない）。 */
export async function humanizeLastFactoryResult(): Promise<{ text: string; errorText: string | null }> {
  const runs = await readPageExecutionRuns()
  const factoryRuns = runs.filter((r) => r.factoryRun || r.source === 'factory_runner')
  const last = factoryRuns[0]
  if (!last) return { text: '前回のAI作業: まだ自動実行の記録がありません。', errorText: null }

  const subject = shorten(subjectOf(humanizeTitle(last.targetTodoTitle || last.summary || '')), 24) || 'AIの作業'
  const reason = `${last.stopReason ?? ''} ${last.errors?.[0] ?? ''}`

  let text: string
  if (last.runStatus === 'completed') {
    text = `前回の自動実行は正常に完了しました（${subject}）。`
  } else if (/max_runs_reached|max_per_epic/.test(reason)) {
    text = `前回の自動実行は上限回数に達して終了しました（${subject}）。異常ではありません。`
  } else if (last.runStatus === 'partial') {
    text = `前回は一部の作業だけ完了しました（${subject}）。残りは次回に回ります。`
  } else if (last.runStatus === 'failed') {
    text = `前回の自動実行でエラーがありました（${subject}）。必要なら今日の判断に出します。`
  } else if (last.runStatus === 'running') {
    text = `いま自動実行が進行中です（${subject}）。`
  } else {
    text = `前回の自動実行は途中で終了しました（${subject}）。次回に続きを行います。`
  }

  const errorText =
    last.runStatus === 'failed'
      ? '前回エラーがあったため、結果はレビュータブで確認できます。'
      : null
  return { text, errorText }
}
