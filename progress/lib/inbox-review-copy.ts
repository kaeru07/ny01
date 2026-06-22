import { classifyRun } from '@/lib/ai-review'
import { buildInbox } from '@/lib/command-center'
import { buildFixRequests } from '@/lib/factory-outlook'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import type { ExecutionRun } from '@/types/execution-run'

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{8,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /Bearer [A-Za-z0-9._-]{10,}/g,
  /-----BEGIN[^-]*-----/g,
]

export interface InboxReviewCopyPayload {
  id: string
  title: string
  createdAt: string
  generatedAt: string
  charCount: number
  markdown: string
}

function maskSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[伏字]'), text)
}

function formatDateTime(iso?: string): string {
  if (!iso) return '未記録'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

function value(text?: string | null): string {
  return text?.trim() ? text.trim() : '未記録'
}

function bullet(items: string[], empty = '- なし'): string {
  const cleaned = items.map((item) => item.trim()).filter(Boolean)
  return cleaned.length > 0 ? cleaned.map((item) => `- ${item}`).join('\n') : empty
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}`
}

function titleOf(run: ExecutionRun): string {
  return value(run.targetTodoTitle || run.summary || run.runId)
}

function summarizePrompt(run: ExecutionRun): string {
  if (run.promptUsed) return run.promptUsed.length > 800 ? `${run.promptUsed.slice(0, 800)}\n（以下省略）` : run.promptUsed
  return run.summary || '元プロンプト本文はExecutionRunに未保存。summaryを代替として参照してください。'
}

function changedFileLines(run: ExecutionRun): string[] {
  return run.changedFiles.map((f) => {
    const suffix = f.change ? `: ${f.change}` : ''
    return `${f.file}${suffix}`
  })
}

function changeLines(run: ExecutionRun, pattern: RegExp): string[] {
  return run.changedFiles
    .filter((f) => pattern.test(`${f.file} ${f.change}`))
    .map((f) => `${f.file}${f.change ? `: ${f.change}` : ''}`)
}

function checkValue(run: ExecutionRun, keys: string[]): string {
  for (const key of keys) {
    const found = run.checks?.[key]
    if (found?.trim()) return found.trim()
  }
  return '未記録'
}

function verificationLines(run: ExecutionRun): string[] {
  const other = Object.entries(run.checks ?? {})
    .filter(([key, val]) => val?.trim() && !['build', 'typescript', 'lint', 'test', 'mainScreen', 'mainScreens', 'mobileLayout', 'iphone'].includes(key))
    .map(([key, val]) => `${key}: ${val}`)
  return [
    `build結果: ${checkValue(run, ['build'])}`,
    `lint結果: ${checkValue(run, ['lint'])}`,
    `TypeScript結果: ${checkValue(run, ['typescript'])}`,
    `test結果: ${checkValue(run, ['test'])}`,
    `実機確認状況: ${checkValue(run, ['iphone', 'mobileLayout', 'mainScreen', 'mainScreens'])}`,
    ...other,
  ]
}

function riskLines(run: ExecutionRun): string[] {
  const classified = classifyRun(run)
  const flags = [
    classified.verdict === 'needs_human' || classified.rule === 'risk_keyword'
      ? `${classified.rule}: ${classified.reason}`
      : '',
    ...run.warnings.map((w) => `warning: ${w}`),
    ...run.errors.map((e) => `error: ${e}`),
  ].filter(Boolean)
  if (run.changedFiles.some((f) => /data\/real|migration|schema|db|database/i.test(f.file))) flags.push('DB/実データに関係する変更があります')
  if (run.changedFiles.some((f) => /api|route\.ts/i.test(f.file))) flags.push('API変更があります')
  return flags
}

function humanCheckLines(run: ExecutionRun): string[] {
  const lines = [
    '抜け漏れがないか',
    '危険な変更がないか',
    '検証が十分か',
    '問題なしにしてよいか',
  ]
  if (run.changedFiles.some((f) => /\.(tsx|css|scss)$|\/components\/|\/app\//.test(f.file))) {
    lines.push('UI表示とiPhone操作に崩れがないか')
  }
  if (run.changedFiles.some((f) => /api|route\.ts/i.test(f.file))) lines.push('APIレスポンスが期待通りか')
  if (run.changedFiles.some((f) => /data\/real|migration|schema|db|database/i.test(f.file))) lines.push('DB/実データの破壊や意図しない変更がないか')
  return lines
}

function renderRun(run: ExecutionRun, index?: number): InboxReviewCopyPayload {
  const generatedAt = new Date().toISOString()
  const apiChanges = changeLines(run, /api|route\.ts|endpoint/i)
  const dbChanges = changeLines(run, /data\/real|migration|schema|db|database/i)
  const uiChanges = changeLines(run, /\.(tsx|css|scss)$|\/components\/|\/app\//)
  const risks = riskLines(run)
  const unchecked = [
    ...run.warnings,
    ...run.errors,
    checkValue(run, ['iphone']) === '未記録' && checkValue(run, ['mobileLayout']) === '未記録' ? 'iPhone実機確認は未記録' : '',
  ].filter(Boolean)
  const needsFollowup = run.reviewStatus === 'needs_followup' ? 'true' : 'false'
  const fixRequest = run.reviewStatus === 'needs_followup' ? value(run.reviewMemo) : 'なし'

  const markdown = maskSecrets(
    [
      `# ${index ? `レビュー${index}: ` : ''}作業レビュー依頼`,
      section(
        'レビューしてほしいこと',
        bullet(['抜け漏れがないか', '危険な変更がないか', '検証が十分か', '問題なしにしてよいか', '次にやるべきこと']),
      ),
      section(
        '対象作業',
        bullet([
          `タイトル: ${titleOf(run)}`,
          `project: ${value(run.epicId || run.targetApp)}`,
          `app名: ${value(run.targetApp)}`,
          `runId: ${run.runId}`,
          `executionRunId: ${run.runId}`,
          `status: ${run.runStatus} / ${run.reviewStatus}`,
          `実行日時: ${formatDateTime(run.startedAt)} - ${formatDateTime(run.finishedAt)}`,
        ]),
      ),
      section('元プロンプト要約', summarizePrompt(run)),
      section('AIがやったこと', value(run.summary)),
      section('変更ファイル', bullet(changedFileLines(run))),
      section('API変更', bullet(apiChanges)),
      section('DB変更', bullet(dbChanges)),
      section('UI変更', bullet(uiChanges)),
      section('検証結果', bullet(verificationLines(run))),
      section(
        'fixRequest / needs_followup',
        bullet([`fixRequest: ${fixRequest}`, `needs_followup: ${needsFollowup}`]),
      ),
      section('未確認事項', bullet(unchecked)),
      section('危険・注意', bullet(risks)),
      section('人間が確認すべきこと', bullet(humanCheckLines(run))),
      section('次回やるべきこと', bullet(run.nextActions)),
      section('AI最終報告', value(run.rawReport)),
      section(
        'レビュー判断してほしいこと',
        bullet(['問題なしで閉じてよいか', '修正依頼に戻すべきか', '次Epicが必要か']),
      ),
    ].join('\n\n'),
  )

  return {
    id: run.runId,
    title: titleOf(run),
    createdAt: run.startedAt,
    generatedAt,
    charCount: markdown.length,
    markdown,
  }
}

async function getReviewRuns(): Promise<ExecutionRun[]> {
  const [inbox, runs] = await Promise.all([buildInbox(), readExecutionRuns()])
  const runById = new Map(runs.map((run) => [run.runId, run]))
  const ids = inbox.reviews.map((card) => card.sourceRunId).filter((id): id is string => Boolean(id))
  return ids.map((id) => runById.get(id)).filter((run): run is ExecutionRun => Boolean(run))
}

export async function buildInboxReviewCopy(id: string): Promise<InboxReviewCopyPayload | null> {
  const runs = await getReviewRuns()
  const run = runs.find((item) => item.runId === id)
  return run ? renderRun(run) : null
}

export async function buildAllInboxReviewCopy(): Promise<InboxReviewCopyPayload> {
  const runs = await getReviewRuns()
  const fixRequests = await buildFixRequests()
  const generatedAt = new Date().toISOString()
  const body = runs.length > 0
    ? runs.map((run, index) => renderRun(run, index + 1).markdown).join('\n\n---\n\n')
    : '# 作業レビュー依頼\n\nレビュー対象はありません。'
  const suffix = `\n\n---\n\n## 全体メモ\n\n- Inboxレビュー件数: ${runs.length}件\n- fixRequest件数: ${fixRequests.count}件`
  const markdown = maskSecrets(`${body}${suffix}`)
  return {
    id: 'all',
    title: 'Inboxレビュー全件',
    createdAt: generatedAt,
    generatedAt,
    charCount: markdown.length,
    markdown,
  }
}
