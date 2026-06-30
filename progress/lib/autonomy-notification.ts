import { AUTONOMY_GOAL_ID } from '@/lib/autonomy-anchor'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'
import { appendAutomationLog } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { isSmtpConfigured, sendMail } from '@/lib/email-sender'

export interface AutonomyNotificationResult {
  checked: boolean
  sent: boolean
  skippedReason?: string
  provider: 'noop' | 'email'
  to: string
}

function buildBody(args: {
  goalTitle: string
  completedAt: string
  runId?: string
  summary?: string
  checks?: Record<string, string | undefined>
}): string {
  const checks = args.checks && Object.keys(args.checks).length > 0
    ? Object.entries(args.checks).map(([key, value]) => `- ${key}: ${value ?? ''}`).join('\n')
    : '- 未記録'
  return [
    `ゴール名: ${args.goalTitle}`,
    `達成日時: ${args.completedAt}`,
    `runId/executionRunId: ${args.runId ?? '未記録'}`,
    `実施要約: ${args.summary ?? '未記録'}`,
    '検証結果:',
    checks,
    '次に確認:',
    '- /goal-planner でGoal状態を確認',
    '- /queue で次回自動実行候補を確認',
    '確認パス: /goal-planner, /queue',
  ].join('\n')
}

export async function checkAutonomyCompletionAndNotify(): Promise<AutonomyNotificationResult> {
  const to = process.env.MAIL_TO || process.env.NOTIFY_EMAIL_TO || 'toku106ma@yahoo.co.jp'
  const data = await readGoals()
  const idx = data.goals.findIndex((goal) => goal.id === AUTONOMY_GOAL_ID)
  if (idx === -1) return { checked: true, sent: false, skippedReason: 'goal_not_found', provider: 'noop', to }

  const goal = data.goals[idx]
  const providerEnv = (process.env.AUTONOMY_EMAIL_PROVIDER || '').trim()
  const hasRealProvider = providerEnv !== 'noop' && isSmtpConfigured()
  if (goal.status !== 'done') return { checked: true, sent: false, skippedReason: 'goal_not_completed', provider: hasRealProvider ? 'email' : 'noop', to }
  // 実送信は autonomyNotifiedAt が立っていれば二重送信防止。no-op は autonomyNotifyNoopAt で「ログ済み」を判定（実送信フラグを消費しない）。
  if (goal.autonomyNotifiedAt) return { checked: true, sent: false, skippedReason: 'already_notified', provider: hasRealProvider ? 'email' : 'noop', to }
  if (!hasRealProvider && goal.autonomyNotifyNoopAt) return { checked: true, sent: false, skippedReason: 'noop_already_logged', provider: 'noop', to }
  if (hasRealProvider && (goal.autonomyNotifyAttempts ?? 0) >= 3) return { checked: true, sent: false, skippedReason: 'attempt_limit', provider: 'email', to }

  const now = new Date().toISOString()
  const runs = await readExecutionRuns()
  const selectedRun = goal.lastSelectedRunId ? runs.find((run) => run.runId === goal.lastSelectedRunId) : undefined
  const latestRun = selectedRun ?? runs
    .filter((run) => run.selection?.selectedGoalKey === AUTONOMY_GOAL_ID || run.epicId === 'epic-91')
    .sort((a, b) => Date.parse(b.finishedAt || b.startedAt) - Date.parse(a.finishedAt || a.startedAt))[0]
  const subject = '【AI工場】自走化ゴール達成報告'
  const body = buildBody({
    goalTitle: goal.title,
    completedAt: now,
    runId: latestRun?.runId,
    summary: latestRun?.summary,
    checks: latestRun?.checks,
  })

  // no-op（実プロバイダ未構成）: 実送信フラグ autonomyNotifiedAt は立てず、autonomyNotifyNoopAt でログ1回だけ記録する。
  // → 後で実メールプロバイダを構成したとき、autonomyNotifiedAt が未設定なので実送信が1回だけ走る（footgun回避）。
  if (!hasRealProvider) {
    data.goals[idx] = { ...goal, autonomyNotifyNoopAt: now, updatedAt: now }
    await writeGoals(data)
    await appendAutomationLog({
      event: 'factory_schedule',
      fallbackReason: `autonomy_notify provider=noop(logged-only) to=${to} subject=${subject} body=${body.slice(0, 500)}`,
      detectionStatus: 'autonomy_notify',
    } as never)
    return { checked: true, sent: false, skippedReason: 'noop_logged_only', provider: 'noop', to }
  }

  const result = await sendMail({ to, subject, body })
  if (result.ok) {
    data.goals[idx] = { ...goal, autonomyNotifiedAt: now, updatedAt: now }
    await writeGoals(data)
    await appendAutomationLog({
      event: 'factory_schedule',
      fallbackReason: `autonomy_notify provider=smtp(sent) to=${to} subject=${subject}`,
      detectionStatus: 'autonomy_notify',
    } as never)

    return { checked: true, sent: true, provider: 'email', to }
  }

  data.goals[idx] = {
    ...goal,
    autonomyNotifyAttempts: (goal.autonomyNotifyAttempts ?? 0) + 1,
    updatedAt: now,
  }
  await writeGoals(data)
  await appendAutomationLog({
    event: 'factory_schedule',
    fallbackReason: `autonomy_notify provider=smtp(send_failed err=${result.error.slice(0, 200)}) to=${to}`,
    detectionStatus: 'autonomy_notify',
  } as never)

  return { checked: true, sent: false, skippedReason: 'send_failed', provider: 'email', to }
}
