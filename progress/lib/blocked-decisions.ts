import { buildAutoQueue } from '@/lib/auto-queue'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { appendAutomationLog, closeApproval, createApproval, getPendingApprovals, updatePendingApproval } from '@/lib/operations-store'
import type { Approval } from '@/lib/types/operations'
import type { AutoQueueItem } from '@/types/auto-queue'
import type { ExecutionRun } from '@/types/execution-run'

type ApprovalOptions = Approval['options']

function isFailedBlockedReason(reason?: string): boolean {
  return Boolean(reason?.includes('failed') || reason?.includes('失敗'))
}

function optionsForBlockedReason(reason?: string): ApprovalOptions {
  if (reason?.includes('危険')) {
    return [
      { key: 'allow', label: '安全を確認して進める' },
      { key: 'cancel', label: 'この作業を中止' },
      { key: 'hold', label: '保留' },
    ]
  }
  if (isFailedBlockedReason(reason)) {
    return [
      { key: 'retry', label: '原因を直して再試行する' },
      { key: 'investigate', label: '原因を調べる（調査タスク化）' },
      { key: 'cancel', label: 'この作業を中止する' },
      { key: 'hold', label: '保留する' },
    ]
  }
  return [
    { key: 'resolve', label: '対処して進める' },
    { key: 'cancel', label: 'この作業を中止' },
    { key: 'hold', label: '保留' },
  ]
}

function summarizeFailure(run?: ExecutionRun): string | undefined {
  if (!run || run.runStatus !== 'failed') return undefined
  const parts = [
    run.summary?.trim(),
    run.stopReason?.trim(),
    (run.errors ?? []).find((error) => error.trim().length > 0)?.trim(),
  ].filter((part): part is string => Boolean(part))
  if (parts.length === 0) return undefined
  return `前回実行が失敗しています: ${parts.join(' / ')}`
}

function reasonForBlockedItem(item: AutoQueueItem, runById: Map<string, ExecutionRun>): string {
  const candidateBlockedReason = item.candidateBlockedReason ?? 'この作業はブロック中です。方針を決めてください。'
  if (isFailedBlockedReason(candidateBlockedReason)) {
    return summarizeFailure(item.latestRunId ? runById.get(item.latestRunId) : undefined) ?? candidateBlockedReason
  }
  return candidateBlockedReason
}

function isAutoBlockedApproval(approval: Approval): boolean {
  if (approval.title.startsWith('ブロック中の作業: ')) return true
  return Boolean(
    approval.epicId &&
    approval.options.some((option) => option.label.includes('この作業を中止')),
  )
}

function sameOptions(a: ApprovalOptions, b: ApprovalOptions): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export async function ensureBlockedDecisions(): Promise<{ created: number; closed: number }> {
  let created = 0
  let closed = 0
  try {
    const [view, pendingApprovals, runs] = await Promise.all([
      buildAutoQueue(),
      getPendingApprovals(),
      readExecutionRuns(),
    ])
    const blockedEpicIds = new Set(view.blocked.map((item) => item.sourceId))
    const runById = new Map(runs.map((run) => [run.runId, run]))
    const pendingEpicIds = new Set(
      pendingApprovals
        .map((approval) => approval.epicId)
        .filter((epicId): epicId is string => Boolean(epicId)),
    )

    for (const approval of pendingApprovals) {
      if (!approval.epicId || blockedEpicIds.has(approval.epicId) || !isAutoBlockedApproval(approval)) continue
      const result = await closeApproval(
        approval.approvalId,
        '対象が再実行可能に戻ったため自動クローズ',
      )
      if (result) {
        pendingEpicIds.delete(approval.epicId)
        closed += 1
      }
    }

    for (const item of view.blocked) {
      const epicId = item.sourceId
      const reason = reasonForBlockedItem(item, runById)
      const options = optionsForBlockedReason(item.candidateBlockedReason)
      const existing = pendingApprovals.find((approval) => approval.epicId === epicId && approval.status === 'pending')
      if (existing) {
        if (isAutoBlockedApproval(existing)) {
          const title = `ブロック中の作業: ${item.title}`
          if (existing.reason !== reason || existing.title !== title || existing.recommended !== options[0].key || !sameOptions(existing.options, options)) {
            await updatePendingApproval(existing.approvalId, {
              title,
              options,
              recommended: options[0].key,
              reason,
            })
          }
        }
        pendingEpicIds.add(epicId)
        continue
      }

      if (pendingEpicIds.has(epicId)) continue

      await createApproval({
        epicId,
        projectId: item.projectId,
        title: `ブロック中の作業: ${item.title}`,
        category: 'multi_option',
        options,
        recommended: options[0].key,
        reason,
      })
      pendingEpicIds.add(epicId)
      created += 1
    }

    await appendAutomationLog({
      event: 'blocked_decisions_ensured',
      fallbackReason: `created=${created} closed=${closed}`,
    })
    return { created, closed }
  } catch (err) {
    console.warn('ensureBlockedDecisions failed:', err)
    try {
      await appendAutomationLog({
        event: 'blocked_decisions_ensured',
        fallbackReason: 'created=0 closed=0',
      })
    } catch (logErr) {
      console.warn('ensureBlockedDecisions log failed:', logErr)
    }
    return { created: 0, closed: 0 }
  }
}
