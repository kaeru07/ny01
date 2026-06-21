import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getAutoQueueView } from '@/lib/auto-queue'
import { updateGoalControl, updateGoalTodo } from '@/lib/goal-writer'
import { getEpics } from '@/lib/operations-store'
import { writeJson } from '@/lib/store'
import type { Epic } from '@/lib/types/operations'
import type { AutoQueueItem } from '@/types/auto-queue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function parseEpicId(workItemId: string): string | null {
  return workItemId.startsWith('epic:') ? workItemId.slice('epic:'.length) : null
}

function parseTodoId(workItemId: string): string | null {
  return workItemId.startsWith('todo:') ? workItemId.slice('todo:'.length) : null
}

function parseGoalId(workItemId: string): string | null {
  return workItemId.startsWith('goal:') ? workItemId.slice('goal:'.length) : null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as { orderedWorkItemIds?: unknown }
    if (!Array.isArray(body.orderedWorkItemIds)) {
      return NextResponse.json({ error: 'orderedWorkItemIds must be an array' }, { status: 400 })
    }

    const orderedWorkItemIds = body.orderedWorkItemIds as string[]
    const queue = await getAutoQueueView()
    const itemById = new Map<string, AutoQueueItem>(
      queue.executable.map((item) => [item.workItemId, item]),
    )
    const orderByEpicId = new Map<string, number>()
    const todoOrders: Array<{ goalId: string; todoId: string; manualOrder: number }> = []
    const goalOrders: Array<{ goalId: string; manualOrder: number }> = []

    orderedWorkItemIds.forEach((id, index) => {
      const item = itemById.get(id)
      if (!item) return

      const manualOrder = index + 1
      if (item.type === 'epic') {
        const epicId = parseEpicId(id)
        if (epicId) orderByEpicId.set(epicId, manualOrder)
        return
      }
      if (item.type === 'goal_todo' && item.goalId) {
        const todoId = parseTodoId(id)
        if (todoId) todoOrders.push({ goalId: item.goalId, todoId, manualOrder })
        return
      }
      if (item.type === 'goal') {
        const goalId = parseGoalId(id)
        if (goalId) goalOrders.push({ goalId, manualOrder })
      }
    })

    if (orderByEpicId.size > 0) {
      const epics = await getEpics()
      const now = new Date().toISOString()
      const nextEpics: Epic[] = epics.map((epic) => {
        const manualOrder = orderByEpicId.get(epic.epicId)
        if (manualOrder === undefined) return epic
        return {
          ...epic,
          queueControl: {
            ...epic.queueControl,
            manualOrder,
            updatedBy: 'user',
            updatedAt: now,
          },
          updatedAt: now,
        }
      })
      await writeJson('epics.json', nextEpics)
    }

    for (const order of todoOrders) {
      await updateGoalTodo(order.goalId, order.todoId, {
        queueControl: { manualOrder: order.manualOrder },
      })
    }
    for (const order of goalOrders) {
      await updateGoalControl(order.goalId, {
        queueControl: { manualOrder: order.manualOrder },
      })
    }

    revalidatePath('/')
    revalidatePath('/queue')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reorder auto queue:', error)
    return NextResponse.json({ error: 'failed to reorder auto queue' }, { status: 500 })
  }
}
