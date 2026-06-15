import { NextResponse } from 'next/server'
import { getAutomationConfig } from '@/lib/operations-store'
import { computeFactoryStatus } from '@/lib/factory-status'
import { buildAutoQueue } from '@/lib/auto-queue'
import { scanFactoryDispatch } from '@/lib/factory-dispatch'
import { AUTONOMY_GOAL_ID } from '@/lib/autonomy-anchor'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const ignoreFactoryState = url.searchParams.get('ignoreFactoryState') === '1'
  const [config, status, queue, scan] = await Promise.all([
    getAutomationConfig(),
    computeFactoryStatus(),
    buildAutoQueue(),
    scanFactoryDispatch(),
  ])

  const blockedByFactoryState = !ignoreFactoryState && (!config.factoryEnabled || status.factoryRunState === 'Blocked')
  const blockedReason = !config.factoryEnabled
    ? 'factory_off'
    : status.factoryRunState === 'Blocked'
      ? 'factory_blocked'
      : undefined

  const queueNext = queue.next
  const dispatchNext = scan.picked
  const selectedGoalKey = dispatchNext?.selectedGoalKey ?? dispatchNext?.goalId ?? queueNext?.goalId ?? null
  const selectedTitle = dispatchNext?.epicTitle ?? queueNext?.title ?? null
  const sameSelection = Boolean(queueNext && dispatchNext && queueNext.sourceId === dispatchNext.epicId)
  const wouldRunNext = !blockedByFactoryState && sameSelection && selectedGoalKey === AUTONOMY_GOAL_ID
  const passed = wouldRunNext

  return NextResponse.json({
    test: 'goal-ai-factory-os-next-run-selection-test',
    passed,
    selectedGoalKey,
    selectedTitle,
    wouldRunNext,
    reason: blockedByFactoryState
      ? `Factory state blocks execution: ${blockedReason}`
      : sameSelection
        ? (dispatchNext?.selectedReason ?? queueNext?.reason ?? 'selection matched')
        : `selection mismatch: queue=${queueNext?.sourceId ?? 'none'} dispatch=${dispatchNext?.epicId ?? 'none'}`,
    blockedByFactoryState,
    blockedReason,
    ignoreFactoryState,
    queue: queueNext ? {
      workItemId: queueNext.workItemId,
      sourceId: queueNext.sourceId,
      goalId: queueNext.goalId,
      title: queueNext.title,
      reason: queueNext.reason,
      queueScore: queueNext.queueScore,
      autonomyAnchor: queueNext.autonomyAnchor === true,
    } : null,
    dispatch: dispatchNext ? {
      epicId: dispatchNext.epicId,
      goalId: dispatchNext.goalId,
      selectedGoalKey: dispatchNext.selectedGoalKey,
      title: dispatchNext.epicTitle,
      selectedReason: dispatchNext.selectedReason,
      autonomyAnchor: dispatchNext.autonomyAnchor === true,
    } : null,
  })
}
