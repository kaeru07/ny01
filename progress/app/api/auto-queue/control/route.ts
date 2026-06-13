import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getAutoQueueView } from '@/lib/auto-queue'
import { getEpics, updateEpic } from '@/lib/operations-store'
import { writeJson } from '@/lib/store'
import type { Epic } from '@/lib/types/operations'
import type { AutoQueueControlAction, QueueControl } from '@/types/auto-queue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ACTIONS: AutoQueueControlAction[] = ['pin', 'unpin', 'hold', 'unhold', 'exclude', 'include', 'moveUp', 'moveDown', 'setManualOrder']

function parseEpicId(workItemId: unknown): string | null {
  if (typeof workItemId !== 'string') return null
  return workItemId.startsWith('epic:') ? workItemId.slice('epic:'.length) : null
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

  const orderByEpicId = new Map<string, number>()
  orderedIds.forEach((id, i) => {
    const epicId = parseEpicId(id)
    if (epicId) orderByEpicId.set(epicId, i + 1)
  })

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
    const action = body.action
    if (!epicId || typeof action !== 'string' || !ACTIONS.includes(action as AutoQueueControlAction)) {
      return NextResponse.json({ error: 'workItemId(epic:*) and valid action are required' }, { status: 400 })
    }

    if (action === 'moveUp' || action === 'moveDown') {
      const ok = await writeManualOrder(`epic:${epicId}`, action === 'moveUp' ? 'up' : 'down')
      if (!ok) return NextResponse.json({ error: 'item is not in executable queue' }, { status: 422 })
      revalidateAutoQueuePages()
      return NextResponse.json({ success: true, queue: await getAutoQueueView() })
    }

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
    } else if (action === 'setManualOrder') {
      const value = typeof body.value === 'number' && Number.isFinite(body.value) ? body.value : undefined
      if (!value) return NextResponse.json({ error: 'numeric value is required' }, { status: 400 })
      patch = { queueControl: userControl(epic.queueControl, { manualOrder: value }) }
    }

    await updateEpic(epicId, patch)
    revalidateAutoQueuePages()
    return NextResponse.json({ success: true, queue: await getAutoQueueView() })
  } catch (err) {
    console.error('Failed to control auto queue:', err)
    return NextResponse.json({ error: 'failed to control auto queue' }, { status: 500 })
  }
}
