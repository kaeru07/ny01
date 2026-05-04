import { NextRequest, NextResponse } from 'next/server'
import { addProject } from '@/lib/progress-writer'
import type { NewProjectInput, ProjectStatus } from '@/types/progress'

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, status, phase, progress, currentTask, nextAction, url } = body

    if (!id || typeof id !== 'string' || !ID_PATTERN.test(id.trim())) {
      return NextResponse.json({ error: 'id は英小文字・数字・ハイフンのみ使用できます' }, { status: 400 })
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '案件名は必須です' }, { status: 400 })
    }

    const validStatuses: ProjectStatus[] = ['in_progress', 'active', 'done', 'blocked', 'archived']
    const resolvedStatus: ProjectStatus = validStatuses.includes(status) ? status : 'in_progress'

    const resolvedProgress = typeof progress === 'number' ? progress : parseInt(progress ?? '0', 10)
    if (isNaN(resolvedProgress) || resolvedProgress < 0 || resolvedProgress > 100) {
      return NextResponse.json({ error: 'progress は 0〜100 の整数を指定してください' }, { status: 400 })
    }

    const input: NewProjectInput = {
      id: id.trim(),
      name: name.trim(),
      status: resolvedStatus,
      phase: typeof phase === 'string' ? phase.trim() : '',
      progress: resolvedProgress,
      currentTask: typeof currentTask === 'string' ? currentTask.trim() : '',
      nextAction: typeof nextAction === 'string' ? nextAction.trim() : '',
      url: typeof url === 'string' ? url.trim() : undefined,
    }

    await addProject(input)
    return NextResponse.json({ success: true, id: input.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('DUPLICATE_ID')) {
      return NextResponse.json({ error: 'この ID はすでに使用されています' }, { status: 409 })
    }
    console.error('Failed to add project:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
