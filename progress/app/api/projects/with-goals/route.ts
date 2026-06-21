import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { upsertSingleGoal } from '@/lib/goal-writer'
import { addProject } from '@/lib/progress-writer'
import type { NewProjectInput, ProjectStatus, TaskPriority } from '@/types/progress'

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
const PROJECT_STATUSES: ProjectStatus[] = [
  'in_progress',
  'active',
  'done',
  'blocked',
  'archived',
  'user_action_pending',
  'deploy_ready',
]
const GOAL_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSONの形式が正しくありません' }, { status: 400 })
  }

  if (!isObject(body) || !isObject(body.project)) {
    return NextResponse.json({ error: 'project は必須です' }, { status: 400 })
  }

  const project = body.project
  const id = optionalString(project.id)
  const name = optionalString(project.name)

  if (!id || !ID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'project.id は英小文字・数字・ハイフンのみ使用できます' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'project.name は必須です' }, { status: 400 })
  }

  const goals = body.goals ?? []
  if (!Array.isArray(goals)) {
    return NextResponse.json({ error: 'goals は配列で指定してください' }, { status: 400 })
  }

  for (let index = 0; index < goals.length; index += 1) {
    const goal = goals[index]
    if (!isObject(goal)) {
      return NextResponse.json({ error: `goals[${index}] が不正です` }, { status: 400 })
    }
    if (!optionalString(goal.title)) {
      return NextResponse.json({ error: `goals[${index}].title は必須です` }, { status: 400 })
    }
    if (goal.priority !== undefined && !GOAL_PRIORITIES.includes(goal.priority as TaskPriority)) {
      return NextResponse.json({ error: `goals[${index}].priority は high / medium / low のいずれかです` }, { status: 400 })
    }
    for (const field of ['target', 'current'] as const) {
      if (goal[field] !== undefined && (typeof goal[field] !== 'number' || !Number.isFinite(goal[field]))) {
        return NextResponse.json({ error: `goals[${index}].${field} は数値で指定してください` }, { status: 400 })
      }
    }
  }

  const rawProgress = project.progress
  const progress = rawProgress === undefined ? 0 : rawProgress
  if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 100) {
    return NextResponse.json({ error: 'project.progress は 0〜100 の数値を指定してください' }, { status: 400 })
  }

  const status = PROJECT_STATUSES.includes(project.status as ProjectStatus)
    ? project.status as ProjectStatus
    : 'in_progress'
  const input: NewProjectInput = {
    id,
    name,
    status,
    phase: optionalString(project.phase) ?? '',
    progress,
    currentTask: optionalString(project.currentTask) ?? '',
    nextAction: optionalString(project.nextAction) ?? '',
    url: optionalString(project.url),
  }

  try {
    let projectCreated = true
    try {
      await addProject(input)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (!message.startsWith('DUPLICATE_ID')) throw error
      projectCreated = false
    }

    const goalIds: string[] = []
    for (const rawGoal of goals) {
      const goal = rawGoal as JsonObject
      const created = await upsertSingleGoal({
        title: optionalString(goal.title) as string,
        projectId: id,
        priority: goal.priority as TaskPriority | undefined,
        prompt: optionalString(goal.prompt) ?? optionalString(goal.summary),
        status: 'active',
        target: goal.target as number | undefined,
        current: goal.current as number | undefined,
      })
      goalIds.push(created.id)
    }

    revalidatePath('/')
    revalidatePath('/queue')
    revalidatePath('/portfolio')
    revalidatePath('/project-goals')
    revalidatePath('/goal-planner')

    return NextResponse.json({
      success: true,
      projectId: id,
      projectCreated,
      goalIds,
      goalsCreated: goalIds.length,
    })
  } catch (error) {
    console.error('Failed to add project with goals:', error)
    return NextResponse.json({ error: 'プロジェクトとゴールの追加に失敗しました' }, { status: 500 })
  }
}
