import { buildAutoQueue } from '@/lib/auto-queue'
import { appendAutomationLog, createApproval, getPendingApprovals } from '@/lib/operations-store'
import type { Approval } from '@/lib/types/operations'

type ApprovalOptions = Approval['options']

function optionsForBlockedReason(reason?: string): ApprovalOptions {
  if (reason?.includes('危険')) {
    return [
      { key: 'allow', label: '安全を確認して進める' },
      { key: 'cancel', label: 'この作業を中止' },
      { key: 'hold', label: '保留' },
    ]
  }
  if (reason?.includes('failed') || reason?.includes('失敗')) {
    return [
      { key: 'retry', label: '原因を直して再試行' },
      { key: 'cancel', label: 'この作業を中止' },
      { key: 'hold', label: '保留' },
    ]
  }
  return [
    { key: 'resolve', label: '対処して進める' },
    { key: 'cancel', label: 'この作業を中止' },
    { key: 'hold', label: '保留' },
  ]
}

export async function ensureBlockedDecisions(): Promise<{ created: number }> {
  let created = 0
  try {
    const [view, pendingApprovals] = await Promise.all([
      buildAutoQueue(),
      getPendingApprovals(),
    ])
    const pendingEpicIds = new Set(
      pendingApprovals
        .map((approval) => approval.epicId)
        .filter((epicId): epicId is string => Boolean(epicId)),
    )

    for (const item of view.blocked) {
      const epicId = item.sourceId
      if (pendingEpicIds.has(epicId)) continue

      const reason = item.candidateBlockedReason ?? 'この作業はブロック中です。方針を決めてください。'
      const options = optionsForBlockedReason(item.candidateBlockedReason)
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
      fallbackReason: `created=${created}`,
    })
    return { created }
  } catch (err) {
    console.warn('ensureBlockedDecisions failed:', err)
    try {
      await appendAutomationLog({
        event: 'blocked_decisions_ensured',
        fallbackReason: 'created=0',
      })
    } catch (logErr) {
      console.warn('ensureBlockedDecisions log failed:', logErr)
    }
    return { created: 0 }
  }
}
