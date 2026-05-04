import { NextRequest, NextResponse } from 'next/server'
import { updateProjectSummary } from '@/lib/progress-writer'
import type { ProjectSummaryUpdate, ProjectStatus } from '@/types/progress'

interface Params {
  params: { projectId: string }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { projectId } = params
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const body = await request.json()
    const validStatuses: ProjectStatus[] = ['in_progress', 'active', 'done', 'blocked', 'archived', 'user_action_pending', 'deploy_ready']
    const updates: ProjectSummaryUpdate = {}

    if (typeof body.currentTask === 'string') updates.currentTask = body.currentTask.trim()
    if (typeof body.nextAction === 'string') updates.nextAction = body.nextAction.trim()
    if (typeof body.phase === 'string') updates.phase = body.phase.trim()
    if (typeof body.url === 'string') updates.url = body.url.trim()
    if (typeof body.status === 'string' && validStatuses.includes(body.status)) {
      updates.status = body.status as ProjectStatus
    }
    if (typeof body.progress === 'number' && !isNaN(body.progress)) {
      updates.progress = body.progress
    } else if (typeof body.progress === 'string') {
      const parsed = parseInt(body.progress, 10)
      if (!isNaN(parsed)) updates.progress = parsed
    }
    if (Array.isArray(body.blockers) && body.blockers.every((b: unknown) => typeof b === 'string')) {
      updates.blockers = (body.blockers as string[]).map((b) => b.trim()).filter(Boolean)
    }
    if (typeof body.excluded === 'boolean') updates.excluded = body.excluded

    await updateProjectSummary(projectId, updates)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to update project summary:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
