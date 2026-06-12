import { classifyRun } from '@/lib/ai-review'
import { buildCommandCenter } from '@/lib/command-center'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { buildFactoryOutlook, buildFixRequests } from '@/lib/factory-outlook'
import { buildQueueSplit } from '@/lib/queue-split'
import type { ExecutionRun } from '@/types/execution-run'

export const RECENT_RUN_DAYS = 7
export const RECENT_RUN_MAX = 10
export const PROJECT_MAX = 8
export const TOTAL_CHAR_BUDGET = 12_000

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{8,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /Bearer [A-Za-z0-9._-]{10,}/g,
  /-----BEGIN[^-]*-----/g,
]

function maskSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[伏字]'), text)
}

function formatDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function ymd(iso?: string): string {
  if (!iso) return '日付不明'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatDateTime(d).slice(0, 10)
}

function daysSince(iso?: string): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

function line(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : 'なし'
}

function checkSummary(run: ExecutionRun): string {
  const entries = Object.entries(run.checks ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0,
  )
  if (entries.length === 0) return '検証記録なし'
  const ng = entries.filter(([, value]) => /\b(ng|fail|failed|error)\b|エラー|失敗|✗/i.test(value))
  if (ng.length > 0) return `検証NG: ${ng.slice(0, 2).map(([k, v]) => `${k}=${v}`).join(' / ')}`
  return `検証OK: ${entries.slice(0, 3).map(([k]) => k).join(', ')}`
}

function runTitle(run: ExecutionRun): string {
  return line(run.targetTodoTitle || run.summary || run.runId)
}

function changedFilesSummary(run: ExecutionRun): string {
  const files = run.changedFiles.map((f) => f.file).filter(Boolean)
  if (files.length === 0) return '変更ファイル記録なし'
  return `変更: ${files.slice(0, 3).join(', ')}${files.length > 3 ? ` ほか${files.length - 3}件` : ''}`
}

function recentRuns(runs: ExecutionRun[], limit: number): { items: ExecutionRun[]; omitted: number } {
  const threshold = Date.now() - RECENT_RUN_DAYS * 86_400_000
  const filtered = runs.filter((r) => {
    const t = Date.parse(r.startedAt)
    return Number.isFinite(t) && t >= threshold
  })
  return { items: filtered.slice(0, limit), omitted: Math.max(0, filtered.length - limit) }
}

function activeProjects(
  projects: Awaited<ReturnType<typeof buildCommandCenter>>['projectProgress'],
  limit: number,
): { items: typeof projects; omitted: number; staleOmitted: number } {
  const fresh = projects.filter((p) => {
    const age = daysSince(p.updatedAt)
    return age === null || age < 30
  })
  const staleOmitted = projects.length - fresh.length
  return {
    items: fresh.slice(0, limit),
    omitted: Math.max(0, fresh.length - limit) + staleOmitted,
    staleOmitted,
  }
}

function bullets(items: string[], empty = '- なし'): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : empty
}

function section(title: string, body: string): string {
  return `## ${title}\n${body.trim()}`
}

export async function buildReviewCopyMarkdown(): Promise<{ markdown: string; generatedAt: string; charCount: number }> {
  const generatedDate = new Date()
  const generatedAtLabel = formatDateTime(generatedDate)
  const generatedAt = generatedDate.toISOString()

  const [commandCenter, queueSplit, factoryOutlook, fixRequests, runs] = await Promise.all([
    buildCommandCenter(),
    buildQueueSplit(),
    buildFactoryOutlook(),
    buildFixRequests(),
    readExecutionRuns(),
  ])

  let recentLimit = RECENT_RUN_MAX
  let projectLimit = PROJECT_MAX
  let markdown = ''

  const render = () => {
    const recent = recentRuns(runs, recentLimit)
    const projects = activeProjects(commandCenter.projectProgress, projectLimit)
    const dataHealth = commandCenter.dataHealth.warningText ? `データ鮮度: ${commandCenter.dataHealth.warningText}` : 'データ鮮度: 警告なし'
    const pendingApprovals = queueSplit.human.filter((item) => item.id.startsWith('approval-'))
    const needsFollowup = runs.filter((r) => r.reviewStatus === 'needs_followup')
    const danger = runs
      .slice(0, RECENT_RUN_MAX)
      .map((run) => ({ run, cls: classifyRun(run) }))
      .filter(({ cls }) => cls.verdict === 'needs_human' || cls.rule === 'risk_keyword')
      .slice(0, 8)

    const sections = [
      section(
        'レビューしてほしいこと',
        bullets([
          '抜け漏れがないか',
          '危険な変更・進め方と優先順位に問題がないか',
          '次回自動実行で優先すべき作業は何か',
          'AI保留を放置してよいか',
        ]),
      ),
      section(
        'AI工場の状態',
        bullets([
          `状態: ${commandCenter.factory.statusLabel}`,
          `自動化率: ${commandCenter.factory.automationRatePct}%`,
          `未レビュー件数: ${commandCenter.factory.notReviewedCount}件`,
          commandCenter.factory.lastResultText,
          commandCenter.factory.lastErrorText ? commandCenter.factory.lastErrorText : '気になる結果: なし',
          `次回自動実行予定: ${factoryOutlook.nextRunText}`,
        ]),
      ),
      section(
        '今日の判断',
        bullets([
          `今日の判断: ${commandCenter.decisionCount}件`,
          ...(commandCenter.todayDecisions.map((d) => `${d.headline}`)),
          commandCenter.factoryStopAlert
            ? `停止アラート: ${commandCenter.factoryStopAlert.reason}（${commandCenter.factoryStopAlert.days}日経過）`
            : '停止アラート: なし',
        ]),
      ),
      section(
        'Inbox内訳',
        bullets([
          `今日の判断: ${commandCenter.decisionCount}件`,
          `レビュー: ${commandCenter.reviewTotal}件`,
          `Epic候補: ${commandCenter.candidateTotal}件`,
          `AI保留: ${commandCenter.aiHoldCount}件`,
          `AI保留内訳: ${
            commandCenter.aiHoldBreakdown.length > 0
              ? commandCenter.aiHoldBreakdown.map((h) => `${h.label}${h.count}件`).join(' / ')
              : 'なし'
          }`,
        ]),
      ),
      section(
        'Now / Next / Later',
        bullets([
          `Now: ${factoryOutlook.nowText}`,
          `Next: ${factoryOutlook.nextText ?? '選定中'}`,
          `Later: ${factoryOutlook.laterText ?? '候補整理中'}`,
          `待機: ${factoryOutlook.waitingCount}件`,
          factoryOutlook.note,
        ]),
      ),
      section(
        'Project進捗',
        `${bullets(
          projects.items.map((p) => {
            const blocker = p.remainingWorkCount > 0 ? 'blocker/残作業あり' : 'blockerなし'
            return `${p.name}: ${p.progressPct}% / 次=${line(p.nextWork)} / ${blocker}`
          }),
        )}${projects.omitted > 0 ? `\n- （他${projects.omitted}件省略${projects.staleOmitted > 0 ? `。うち${projects.staleOmitted}件は30日以上更新なし` : ''}）` : ''}`,
      ),
      section(
        'Goal進捗',
        bullets(
          commandCenter.goalProgress.map(
            (g) => `${g.title}: ${g.achievementPct}% / 現在地=${g.currentPlace} / 次=${g.nextMilestone} / 根拠=${g.basis}`,
          ),
        ),
      ),
      section(
        'Revenue',
        bullets([
          `現在収益: ${commandCenter.currentRevenueText}`,
          `マイルストーン: ${commandCenter.milestones
            .map((m) => `${m.state === 'current' ? '現在位置=' : ''}${m.label}（${m.state}）`)
            .join(' → ')}`,
        ]),
      ),
      section(
        '最近の作業',
        `${bullets(
          recent.items.map((r) => {
            const mark = r.runStatus === 'partial' || /NG/.test(checkSummary(r)) ? '⚠ ' : ''
            return `${mark}${ymd(r.startedAt)} / [${r.targetApp || 'app不明'}] / ${runTitle(r)} / ${r.runStatus} / ${checkSummary(r)} / ${changedFilesSummary(r)}`
          }),
        )}${recent.omitted > 0 ? `\n- （他${recent.omitted}件省略）` : ''}`,
      ),
      section(
        '未実装・保留',
        bullets([
          `needs_followup: ${needsFollowup.length}件${
            needsFollowup.length > 0
              ? `（${needsFollowup.slice(0, 5).map((r) => runTitle(r)).join(' / ')}${needsFollowup.length > 5 ? ` / 他${needsFollowup.length - 5}件` : ''}）`
              : ''
          }`,
          `ユーザー判断待ち: ${pendingApprovals.length}件${
            pendingApprovals.length > 0
              ? `（${pendingApprovals.slice(0, 5).map((a) => a.title).join(' / ')}${pendingApprovals.length > 5 ? ` / 他${pendingApprovals.length - 5}件` : ''}）`
              : ''
          }`,
          `fixRequests: ${fixRequests.count}件${
            fixRequests.items.length > 0
              ? `（${fixRequests.items.map((i) => `${i.title}:${i.stage}`).join(' / ')}${fixRequests.count > fixRequests.items.length ? ` / 他${fixRequests.count - fixRequests.items.length}件` : ''}）`
              : ''
          }`,
        ]),
      ),
      section(
        '危険・注意',
        danger.length > 0
          ? bullets(danger.map(({ run, cls }) => `${ymd(run.startedAt)} / [${run.targetApp}] / ${runTitle(run)} / ${cls.verdict} / ${cls.reason}`))
          : 'なし',
      ),
      section(
        '次回自動実行で優先すべき作業',
        bullets([
          factoryOutlook.nextText ? `次回予定: ${factoryOutlook.nextText}` : '次回予定: 選定中',
          commandCenter.factoryOutlook.nextText ? `司令塔Next: ${commandCenter.factoryOutlook.nextText}` : '司令塔Nowからの導出: 候補整理中',
        ]),
      ),
      section('相談したいこと', '（ここに追記してから貼ってください）'),
    ]

    return maskSecrets(`# progress 状況レビュー依頼（${generatedAtLabel} 生成）\n${dataHealth}\n\n${sections.join('\n\n')}`)
  }

  markdown = render()
  while (markdown.length > TOTAL_CHAR_BUDGET && recentLimit > 0) {
    recentLimit -= 1
    markdown = render()
  }
  while (markdown.length > TOTAL_CHAR_BUDGET && projectLimit > 0) {
    projectLimit -= 1
    markdown = render()
  }
  if (markdown.length > TOTAL_CHAR_BUDGET) {
    markdown = `${markdown.slice(0, TOTAL_CHAR_BUDGET - 40)}\n\n（文字数上限により末尾省略）`
  }
  markdown = maskSecrets(markdown)

  return { markdown, generatedAt, charCount: markdown.length }
}
