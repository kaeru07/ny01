import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAutoQueueView } from '@/lib/auto-queue'
import { updateGoalControl, updateGoalTodo } from '@/lib/goal-writer'
import { getEpics, updateEpic } from '@/lib/operations-store'
import { writeJson } from '@/lib/store'
import type { Epic } from '@/lib/types/operations'
import type { AutoQueueControlAction, AutoQueueItem, QueueControl } from '@/types/auto-queue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ACTIONS: AutoQueueControlAction[] = ['pin', 'unpin', 'hold', 'unhold', 'exclude', 'include', 'prioritize', 'complete', 'moveUp', 'moveDown', 'setManualOrder']

function parseEpicId(workItemId: unknown): string | null {
  if (typeof workItemId !== 'string') return null
  return workItemId.startsWith('epic:') ? workItemId.slice('epic:'.length) : null
}

function parseTodoId(workItemId: unknown): string | null {
  if (typeof workItemId !== 'string') return null
  return workItemId.startsWith('todo:') ? workItemId.slice('todo:'.length) : null
}

function parseGoalId(workItemId: unknown): string | null {
  if (typeof workItemId !== 'string') return null
  return workItemId.startsWith('goal:') ? workItemId.slice('goal:'.length) : null
}

function userControl(previous: QueueControl | undefined, patch: QueueControl): QueueControl {
  const now = new Date().toISOString()
  return { ...previous, ...patch, updatedBy: 'user', updatedAt: now }
}

async function writeManualOrder(workItemId: string, direction: 'up' | 'down'): Promise<boolean> {
  const queue = await getAutoQueueView()
  const executable = queue.executable
  const idx = executable.findIndex((item) => item.workItemId === workItemId)
  if (idx === -1) return false
  const swapWith = direction === 'up' ? idx - 1 : idx + 1
  if (swapWith < 0 || swapWith >= executable.length) return true

  const orderedIds = executable.map((item) => item.workItemId)
  const tmp = orderedIds[idx]
  orderedIds[idx] = orderedIds[swapWith]
  orderedIds[swapWith] = tmp

  const itemById = new Map<string, AutoQueueItem>(executable.map((item) => [item.workItemId, item]))
  const orderByEpicId = new Map<string, number>()
  const todoOrders: Array<{ goalId: string; todoId: string; manualOrder: number }> = []
  const goalOrders: Array<{ goalId: string; manualOrder: number }> = []
  orderedIds.forEach((id, i) => {
    const item = itemById.get(id)
    if (!item) return
    const manualOrder = i + 1
    const epicId = parseEpicId(id)
    const todoId = parseTodoId(id)
    const goalId = parseGoalId(id)
    if (item.type === 'epic' && epicId) {
      orderByEpicId.set(epicId, manualOrder)
    } else if (item.type === 'goal_todo' && item.goalId && todoId) {
      todoOrders.push({ goalId: item.goalId, todoId, manualOrder })
    } else if (item.type === 'goal' && goalId) {
      goalOrders.push({ goalId, manualOrder })
    }
  })

  if (orderByEpicId.size > 0) {
    const epics = await getEpics()
    const now = new Date().toISOString()
    const nextEpics: Epic[] = epics.map((epic) => {
      const manualOrder = orderByEpicId.get(epic.epicId)
      if (!manualOrder) return epic
      return {
        ...epic,
        queueControl: { ...epic.queueControl, manualOrder, updatedBy: 'user', updatedAt: now },
        updatedAt: now,
      }
    })
    await writeJson('epics.json', nextEpics)
  }
  for (const order of todoOrders) {
    await updateGoalTodo(order.goalId, order.todoId, { queueControl: { manualOrder: order.manualOrder } })
  }
  for (const order of goalOrders) {
    await updateGoalControl(order.goalId, { queueControl: { manualOrder: order.manualOrder } })
  }
  return true
}

function revalidateAutoQueuePages() {
  try {
    revalidatePath('/')
    revalidatePath('/queue')
  } catch (err) {
    console.warn('Failed to revalidate auto queue pages:', err)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { workItemId?: unknown; action?: unknown; value?: unknown }
    const epicId = parseEpicId(body.workItemId)
    const todoId = parseTodoId(body.workItemId)
    const goalId = parseGoalId(body.workItemId)
    const action = body.action
    if ((!epicId && !todoId && !goalId) || typeof action !== 'string' || !ACTIONS.includes(action as AutoQueueControlAction)) {
      return NextResponse.json({ error: 'workItemId(epic:*, todo:* or goal:*) and valid action are required' }, { status: 400 })
    }

    if (action === 'moveUp' || action === 'moveDown') {
      const ok = await writeManualOrder(body.workItemId as string, action === 'moveUp' ? 'up' : 'down')
      if (!ok) return NextResponse.json({ error: 'item is not in executable queue' }, { status: 422 })
      revalidateAutoQueuePages()
      return NextResponse.json({ success: true, queue: await getAutoQueueView() })
    }

    if (todoId) {
      const queue = await getAutoQueueView()
      const item = [
        ...queue.executable,
        ...queue.waitingUser,
        ...queue.held,
        ...queue.aiHold,
        ...queue.reviewWaiting,
        ...queue.blocked,
        ...queue.manual,
      ].find((entry) => entry.workItemId === `todo:${todoId}`)
      if (!item?.goalId) return NextResponse.json({ error: 'goal todo not found' }, { status: 404 })

      const now = new Date().toISOString()
      if (action === 'pin') {
        await updateGoalTodo(item.goalId, todoId, { queueControl: { pinnedTop: true, pinnedAt: now } })
      } else if (action === 'unpin') {
        await updateGoalTodo(item.goalId, todoId, { queueControl: { pinnedTop: false, pinnedAt: undefined } })
      } else if (action === 'hold') {
        await updateGoalTodo(item.goalId, todoId, { queueControl: { hold: true } })
      } else if (action === 'unhold') {
        await updateGoalTodo(item.goalId, todoId, { queueControl: { hold: false } })
      } else if (action === 'include') {
        await updateGoalTodo(item.goalId, todoId, { status: 'pending', queueControl: { hold: false, excludedByUser: false } })
      } else if (action === 'prioritize') {
        await updateGoalTodo(item.goalId, todoId, { priority: 'high', queueControl: { pinnedTop: true, pinnedAt: now, hold: false, excludedByUser: false } })
      } else if (action === 'complete') {
        await updateGoalTodo(item.goalId, todoId, { status: 'done' })
      } else if (action === 'exclude') {
        await updateGoalTodo(item.goalId, todoId, { queueControl: { excludedByUser: true, hold: true } })
      } else {
        return NextResponse.json({ error: 'action is not supported for goal todo' }, { status: 422 })
      }
      revalidateAutoQueuePages()
      revalidatePath('/goal-planner')
      return NextResponse.json({ success: true, queue: await getAutoQueueView() })
    }

    if (goalId) {
      const queue = await getAutoQueueView()
      const item = [
        ...queue.executable,
        ...queue.waitingUser,
        ...queue.held,
        ...queue.aiHold,
        ...queue.reviewWaiting,
        ...queue.blocked,
        ...queue.manual,
      ].find((entry) => entry.workItemId === `goal:${goalId}`)
      if (!item) return NextResponse.json({ error: 'goal not found' }, { status: 404 })

      if (action === 'pin') {
        await updateGoalControl(goalId, { pinnedTop: true })
      } else if (action === 'unpin') {
        await updateGoalControl(goalId, { pinnedTop: false })
      } else if (action === 'prioritize') {
        await updateGoalControl(goalId, { pinnedTop: true, priorityBoost: 2, queueControl: { hold: false, excludedByUser: false } })
      } else if (action === 'hold') {
        await updateGoalControl(goalId, { queueControl: { hold: true } })
      } else if (action === 'unhold') {
        await updateGoalControl(goalId, { queueControl: { hold: false } })
      } else if (action === 'exclude') {
        await updateGoalControl(goalId, { queueControl: { excludedByUser: true, hold: true } })
      } else if (action === 'include') {
        await updateGoalControl(goalId, { queueControl: { excludedByUser: false, hold: false } })
      } else if (action === 'complete') {
        return NextResponse.json({ error: 'action is not supported for goal' }, { status: 422 })
      } else {
        return NextResponse.json({ error: 'action is not supported for goal' }, { status: 422 })
      }
      revalidateAutoQueuePages()
      revalidatePath('/goal-planner')
      return NextResponse.json({ success: true, queue: await getAutoQueueView() })
    }

    if (!epicId) return NextResponse.json({ error: 'epic not found' }, { status: 404 })
    const epics = await getEpics()
    const epic = epics.find((e) => e.epicId === epicId)
    if (!epic) return NextResponse.json({ error: 'epic not found' }, { status: 404 })

    let patch: Partial<Epic> = {}
    if (action === 'pin') {
      patch = { queueControl: userControl(epic.queueControl, { pinnedTop: true, pinnedAt: new Date().toISOString() }) }
    } else if (action === 'unpin') {
      patch = { queueControl: userControl(epic.queueControl, { pinnedTop: false, pinnedAt: undefined }) }
    } else if (action === 'hold') {
      patch = { queueControl: userControl(epic.queueControl, { hold: true }) }
    } else if (action === 'unhold') {
      patch = { queueControl: userControl(epic.queueControl, { hold: false }) }
    } else if (action === 'exclude') {
      patch = { factoryEligible: false, queueControl: userControl(epic.queueControl, { excludedByUser: true }) }
    } else if (action === 'include') {
      patch = { factoryEligible: true, queueControl: userControl(epic.queueControl, { excludedByUser: false }) }
    } else if (action === 'prioritize') {
      patch = {
        priority: 'P0',
        factoryEligible: true,
        queueControl: userControl(epic.queueControl, {
          pinnedTop: true,
          pinnedAt: new Date().toISOString(),
          hold: false,
          excludedByUser: false,
        }),
      }
    } else if (action === 'complete') {
      patch = {
        status: 'done',
        progress: 100,
        remainingWork: [],
        factoryEligible: false,
        queueControl: userControl(epic.queueControl, {
          pinnedTop: false,
          hold: false,
          excludedByUser: false,
        }),
      }
    } else if (action === 'setManualOrder') {
      const value = typeof body.value === 'number' && Number.isFinite(body.value) ? body.value : undefined
      if (!value) return NextResponse.json({ error: 'numeric value is required' }, { status: 400 })
      patch = { queueControl: userControl(epic.queueControl, { manualOrder: value }) }
    } else {
      return NextResponse.json({ error: 'action is not supported for epic' }, { status: 422 })
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'action produced no state change' }, { status: 422 })
    }

    await updateEpic(epicId, patch)
    revalidateAutoQueuePages()
    return NextResponse.json({ success: true, queue: await getAutoQueueView() })
  } catch (err) {
    console.error('Failed to control auto queue:', err)
    return NextResponse.json({ error: 'failed to control auto queue' }, { status: 500 })
  }
}
