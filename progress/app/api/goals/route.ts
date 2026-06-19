import { NextRequest, NextResponse } from 'next/server'
import { readGoals } from '@/lib/goal-reader'
import { readAppProgress } from '@/lib/progress-reader'
import { appendGoalTodos, importGoal, updateGoalTodo, upsertGoal, upsertSingleGoal, validateGoalImport } from '@/lib/goal-writer'
import { recordOperationalDecision } from '@/lib/operations-store'

export async function GET() {
  try {
    const data = await readGoals()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Failed to read goals:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body?.action === 'upsert') {
      const goal = await upsertGoal(body.goal ?? body)
      await recordOperationalDecision({
        action: 'goal_adjust',
        topic: `Goal調整: ${goal.title}`,
        decision: `metric=${goal.metric ?? '-'} target=${goal.target ?? '-'} current=${goal.current ?? '-'} status=${goal.status}`,
        goalId: goal.id,
      })
      return NextResponse.json({ success: true, goal })
    }

    if (body?.action === 'upsertSingle') {
      const goal = await upsertSingleGoal(body.goal ?? body)
      await recordOperationalDecision({
        action: 'goal_adjust',
        topic: `Goal追加: ${goal.title}`,
        decision: `project=${goal.projectId ?? '-'} status=${goal.status} priority=${goal.priority}`,
        goalId: goal.id,
      })
      return NextResponse.json({ success: true, goal })
    }

    if (body?.action === 'appendTodos') {
      const goalId = typeof body.goalId === 'string' ? body.goalId : ''
      if (!goalId) return NextResponse.json({ error: 'goalId is required' }, { status: 400 })
      const todos = Array.isArray(body.todos) ? body.todos : body.todo ? [body.todo] : []
      const result = await appendGoalTodos(goalId, todos)
      return NextResponse.json({ success: true, goalId: result.goal.id, todoIds: result.todos.map((todo) => todo.id), count: result.todos.length })
    }

    if (body?.action === 'updateTodo') {
      const goalId = typeof body.goalId === 'string' ? body.goalId : ''
      const todoId = typeof body.todoId === 'string' ? body.todoId : ''
      if (!goalId || !todoId) return NextResponse.json({ error: 'goalId and todoId are required' }, { status: 400 })
      const todo = await updateGoalTodo(goalId, todoId, body.updates ?? body)
      return NextResponse.json({ success: true, todo })
    }

    const progress = await readAppProgress()
    const projects = progress.projects.map((p) => ({ id: p.id, name: p.name }))

    // 複数ゴールの取り込みに対応（ChatGPTからの一括）: { goals:[...] } / 配列 / 単一オブジェクト すべて受ける。
    const extractGoals = (payload: unknown): unknown[] => {
      if (Array.isArray(payload)) return payload
      if (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).goals)) {
        return (payload as Record<string, unknown>).goals as unknown[]
      }
      return [payload]
    }

    if (body?.action === 'validate') {
      const items = extractGoals(body.payload ?? body)
      const results = items.map((it) => validateGoalImport(it, projects))
      if (results.length === 1) return NextResponse.json(results[0])
      return NextResponse.json({
        ok: results.every((r) => r.ok),
        multi: true,
        count: results.length,
        phaseCount: results.reduce((s, r) => s + r.phaseCount, 0),
        todoCount: results.reduce((s, r) => s + r.todoCount, 0),
        errors: results.flatMap((r, i) => r.errors.map((e) => `goal[${i + 1}]: ${e}`)),
        warnings: results.flatMap((r, i) => r.warnings.map((w) => `goal[${i + 1}]: ${w}`)),
      })
    }

    const items = extractGoals(body)
    const results = []
    for (const it of items) {
      results.push(await importGoal(it, { projects }))
    }
    const created = results.filter((r) => r.goalId)
    if (created.length === 0) {
      return NextResponse.json({ success: false, errors: results.flatMap((r) => r.errors) }, { status: 400 })
    }
    if (results.length === 1) {
      return NextResponse.json({ success: true, ...results[0] })
    }
    return NextResponse.json({
      success: true,
      multi: true,
      createdCount: created.length,
      phaseCount: results.reduce((s, r) => s + r.phaseCount, 0),
      todoCount: results.reduce((s, r) => s + r.todoCount, 0),
      queuedCount: results.reduce((s, r) => s + r.queuedCount, 0),
      queueSkippedCount: results.reduce((s, r) => s + r.queueSkippedCount, 0),
      warnings: results.flatMap((r, i) => r.warnings.map((w) => `goal[${i + 1}]: ${w}`)),
    })
  } catch (err) {
    console.error('Failed to import goal:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const goal = await upsertGoal(body.goal ?? body)
    await recordOperationalDecision({
      action: 'goal_adjust',
      topic: `Goal調整: ${goal.title}`,
      decision: `metric=${goal.metric ?? '-'} target=${goal.target ?? '-'} current=${goal.current ?? '-'} status=${goal.status}`,
      goalId: goal.id,
    })
    return NextResponse.json({ success: true, goal })
  } catch (err) {
    console.error('Failed to save goal:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: msg.includes('required') ? 400 : 500 })
  }
}
