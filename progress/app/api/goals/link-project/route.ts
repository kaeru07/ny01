import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { linkGoalProject } from '@/lib/goal-writer'
import type { GoalStatus } from '@/types/goal'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ゴールをプロジェクトに紐づける。「ゴールは必ずプロジェクトに紐づく」運用のためのトリガ。
// body: { assignments?: [{goalId, projectId}], defaultProjectId?: string, onlyStatuses?: GoalStatus[] }
//  - assignments: 個別指定
//  - defaultProjectId: 未紐付け(projectId無し)のゴールに一括設定（onlyStatuses で対象状態を絞れる）
export async function POST(req: Request) {
  let body: { assignments?: unknown; defaultProjectId?: unknown; onlyStatuses?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json body' }, { status: 400 })
  }
  const assignments = Array.isArray(body.assignments)
    ? body.assignments.filter((a): a is { goalId: string; projectId: string } =>
        Boolean(a) && typeof (a as { goalId?: unknown }).goalId === 'string' && typeof (a as { projectId?: unknown }).projectId === 'string')
    : undefined
  const defaultProjectId = typeof body.defaultProjectId === 'string' ? body.defaultProjectId : undefined
  const onlyStatuses = Array.isArray(body.onlyStatuses)
    ? (body.onlyStatuses.filter((s): s is GoalStatus => typeof s === 'string') as GoalStatus[])
    : undefined

  if ((!assignments || assignments.length === 0) && !defaultProjectId) {
    return NextResponse.json({ success: false, error: 'assignments[] or defaultProjectId required' }, { status: 400 })
  }

  try {
    const result = await linkGoalProject({ assignments, defaultProjectId, onlyStatuses })
    try {
      revalidatePath('/')
      revalidatePath('/goal-planner')
      revalidatePath('/project-goals')
    } catch (err) {
      console.warn('Failed to revalidate after link-project:', err)
    }
    return NextResponse.json({ success: true, linked: result.linked, details: result.details })
  } catch (err) {
    console.error('Failed to link goals to project:', err)
    return NextResponse.json({ success: false, error: 'failed to link goals to project' }, { status: 500 })
  }
}
