import { NextRequest, NextResponse } from 'next/server'
import { readGoals } from '@/lib/goal-reader'
import { importGoal } from '@/lib/goal-writer'
import { readAppProgress } from '@/lib/progress-reader'
import { getCandidates } from '@/lib/monetization-store'
import { buildMonetizationCandidateGoalImports } from '@/lib/monetization-goal-migration'
import { recordOperationalDecision } from '@/lib/operations-store'

const DEFAULT_PROJECT_ID = 'company-mgmt'

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

async function buildImportPlan(body?: Record<string, unknown>) {
  const candidateIds = stringArray(body?.candidateIds)
  const requestedProjectId = typeof body?.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : DEFAULT_PROJECT_ID
  const [candidates, goalsData, progress] = await Promise.all([
    getCandidates(),
    readGoals(),
    readAppProgress(),
  ])
  const selected = candidateIds.length > 0
    ? candidates.filter((candidate) => candidateIds.includes(candidate.id))
    : candidates
  const existingTitles = new Set(goalsData.goals.map((goal) => goal.title.trim()))
  const projects = progress.projects.map((project) => ({ id: project.id, name: project.name }))
  const projectExists = projects.some((project) => project.id === requestedProjectId)
  const projectId = projectExists ? requestedProjectId : DEFAULT_PROJECT_ID
  const imports = buildMonetizationCandidateGoalImports(selected).map((item) => ({
    ...item,
    projectId,
  }))

  return {
    candidateIds,
    selected,
    imports,
    projects,
    skipped: imports
      .filter((item) => existingTitles.has(item.goalTitle.trim()))
      .map((item) => ({ goalTitle: item.goalTitle, reason: 'already_exists' })),
    importable: imports.filter((item) => !existingTitles.has(item.goalTitle.trim())),
  }
}

export async function GET() {
  try {
    const plan = await buildImportPlan()
    return NextResponse.json({
      success: true,
      dryRun: true,
      candidateCount: plan.selected.length,
      importableCount: plan.importable.length,
      skippedCount: plan.skipped.length,
      skipped: plan.skipped,
      goals: plan.imports.map((item) => ({
        goalTitle: item.goalTitle,
        status: item.status ?? 'active',
        projectId: item.projectId,
        todoCount: item.todos.length,
      })),
    })
  } catch (err) {
    console.error('Failed to preview goal imports:', err)
    return NextResponse.json({ success: false, error: 'failed to preview goal imports' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const dryRun = body.dryRun === true
    const plan = await buildImportPlan(body)

    if (plan.candidateIds.length > 0 && plan.selected.length !== plan.candidateIds.length) {
      const found = new Set(plan.selected.map((candidate) => candidate.id))
      return NextResponse.json({
        success: false,
        error: 'candidate not found',
        missingCandidateIds: plan.candidateIds.filter((id) => !found.has(id)),
      }, { status: 404 })
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        candidateCount: plan.selected.length,
        importableCount: plan.importable.length,
        skippedCount: plan.skipped.length,
        skipped: plan.skipped,
      })
    }

    const results = []
    for (const item of plan.importable) {
      results.push(await importGoal(item, { projects: plan.projects }))
    }
    const created = results.filter((result) => result.goalId)

    if (created.length > 0) {
      await recordOperationalDecision({
        action: 'goal_adjust',
        topic: '収益化候補をGoalへ移行',
        decision: `monetization-candidates ${created.length}件をGoalとして登録。Vault詳細はリンク参照に集約。`,
      })
    }

    return NextResponse.json({
      success: true,
      candidateCount: plan.selected.length,
      createdCount: created.length,
      skippedCount: plan.skipped.length,
      skipped: plan.skipped,
      goalIds: created.map((result) => result.goalId),
      phaseCount: results.reduce((sum, result) => sum + result.phaseCount, 0),
      todoCount: results.reduce((sum, result) => sum + result.todoCount, 0),
      queuedCount: results.reduce((sum, result) => sum + result.queuedCount, 0),
      queueSkippedCount: results.reduce((sum, result) => sum + result.queueSkippedCount, 0),
      warnings: results.flatMap((result, index) => result.warnings.map((warning) => `goal[${index + 1}]: ${warning}`)),
      errors: results.flatMap((result, index) => result.errors.map((error) => `goal[${index + 1}]: ${error}`)),
    })
  } catch (err) {
    console.error('Failed to import monetization candidates as goals:', err)
    return NextResponse.json({ success: false, error: 'failed to import monetization candidates as goals' }, { status: 500 })
  }
}
