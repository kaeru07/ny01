import { readGoals } from '@/lib/goal-reader'
import { readPageAppProgress, readPageProjectTasks, readPageRecommendations } from '@/lib/page-data-cache'
import type { Goal } from '@/types/goal'

export interface ProjectCompletionGoal {
  id: string
  title: string
  summary?: string
}

export interface ProjectCompletionCandidate {
  id: string
  title: string
  kind: string
}

export interface ProjectCompletion {
  projectId: string
  projectTitle: string
  achievedGoals: ProjectCompletionGoal[]
  deliveredCount: number
  nextCandidates: ProjectCompletionCandidate[]
  pausedCount: number
  proposedCount: number
}

export interface ProjectCompletionProgress {
  projectId: string
  projectTitle: string
  achieved: number
  total: number
  remainingGoals: ProjectCompletionGoal[]
  pausedCount: number
  proposedCount: number
}

export interface ProjectWithoutGoals {
  projectId: string
  projectTitle: string
}

export interface ProjectCompletionView {
  completions: ProjectCompletion[]
  progress: ProjectCompletionProgress[]
  nearCompletions: ProjectCompletionProgress[]
  projectsWithoutGoals: ProjectWithoutGoals[]
}

function isAchieved(goal: Goal): boolean {
  return (
    goal.status === 'done'
    || (
      typeof goal.target === 'number'
      && goal.target > 0
      && typeof goal.current === 'number'
      && goal.current >= goal.target
    )
  )
}

function sameProject(projectId: string, value?: string): boolean {
  if (!projectId || !value) return false
  const a = projectId.toLowerCase()
  const b = value.toLowerCase()
  return a === b || a.includes(b) || b.includes(a)
}

function pushUnique(candidates: ProjectCompletionCandidate[], item: ProjectCompletionCandidate) {
  if (candidates.some((candidate) => candidate.id === item.id)) return
  candidates.push(item)
}

export async function getProjectCompletionView(): Promise<ProjectCompletionView> {
  const [goalsData, appProgress, projectTasks, recommendations] = await Promise.all([
    readGoals(),
    readPageAppProgress(),
    readPageProjectTasks(),
    readPageRecommendations(),
  ])

  const projectTitleById = new Map<string, string>()
  for (const project of appProgress.projects) {
    projectTitleById.set(project.id, project.name)
  }
  for (const project of projectTasks.projects) {
    if (!projectTitleById.has(project.projectId)) projectTitleById.set(project.projectId, project.projectId)
  }

  const denominatorGoals = goalsData.goals.filter((goal) => (goal.status === 'active' || goal.status === 'done') && goal.projectId)
  const goalById = new Map(goalsData.goals.map((goal) => [goal.id, goal]))
  const goalsByProject = denominatorGoals.reduce((map, goal) => {
    const projectId = goal.projectId as string
    const group = map.get(projectId)
    if (group) group.push(goal)
    else map.set(projectId, [goal])
    return map
  }, new Map<string, Goal[]>())
  const allGoalsByProject = goalsData.goals.reduce((map, goal) => {
    if (!goal.projectId) return map
    const group = map.get(goal.projectId)
    if (group) group.push(goal)
    else map.set(goal.projectId, [goal])
    return map
  }, new Map<string, Goal[]>())

  const supplementaryCounts = (projectId: string) => {
    const allGoals = allGoalsByProject.get(projectId) ?? []
    return {
      pausedCount: allGoals.filter((goal) => goal.status === 'paused').length,
      proposedCount: allGoals.filter((goal) => goal.status === 'proposed').length,
    }
  }

  const progress: ProjectCompletionProgress[] = Array.from(goalsByProject)
    .map(([projectId, goals]) => {
      const achieved = goals.filter(isAchieved).length
      const remainingGoals = goals
        .filter((goal) => !isAchieved(goal))
        .map((goal) => ({
          id: goal.id,
          title: goal.title,
          summary: goal.summary || goal.description || undefined,
        }))
      const counts = supplementaryCounts(projectId)
      return {
        projectId,
        projectTitle: projectTitleById.get(projectId) ?? projectId,
        achieved,
        total: goals.length,
        remainingGoals,
        pausedCount: counts.pausedCount,
        proposedCount: counts.proposedCount,
      }
    })
    .sort((a, b) => (b.achieved / b.total) - (a.achieved / a.total) || a.projectTitle.localeCompare(b.projectTitle, 'ja'))

  const completions: ProjectCompletion[] = Array.from(goalsByProject)
    .filter(([, goals]) => goals.length > 0 && goals.every(isAchieved))
    .map(([projectId, goals]) => {
      const nextCandidates: ProjectCompletionCandidate[] = []

      for (const goal of goalsData.goals.filter((goal) => goal.projectId === projectId && goal.status === 'proposed')) {
        pushUnique(nextCandidates, { id: goal.id, title: goal.title, kind: 'proposed_goal' })
      }

      for (const recommendation of recommendations) {
        const linkedGoal = recommendation.goalId ? goalById.get(recommendation.goalId) : undefined
        const matchesProject =
          sameProject(projectId, recommendation.targetApp)
          || linkedGoal?.projectId === projectId
        if (!matchesProject) continue
        pushUnique(nextCandidates, {
          id: recommendation.id,
          title: recommendation.title,
          kind: recommendation.kind,
        })
        if (nextCandidates.length >= 5) break
      }

      const achievedGoals = goals
        .filter(isAchieved)
        .map((goal) => ({
          id: goal.id,
          title: goal.title,
          summary: goal.summary || goal.description || undefined,
        }))
      const counts = supplementaryCounts(projectId)

      return {
        projectId,
        projectTitle: projectTitleById.get(projectId) ?? projectId,
        achievedGoals,
        deliveredCount: achievedGoals.length,
        nextCandidates: nextCandidates.slice(0, 5),
        pausedCount: counts.pausedCount,
        proposedCount: counts.proposedCount,
      }
    })
    .sort((a, b) => b.deliveredCount - a.deliveredCount || a.projectTitle.localeCompare(b.projectTitle, 'ja'))

  const completedProjectIds = new Set(completions.map((completion) => completion.projectId))
  const nearCompletions = progress
    .filter((item) => !completedProjectIds.has(item.projectId))
    .slice(0, 5)

  const projectsWithoutGoals = Array.from(projectTitleById)
    .filter(([projectId]) => !allGoalsByProject.has(projectId))
    .map(([projectId, projectTitle]) => ({ projectId, projectTitle }))
    .sort((a, b) => a.projectTitle.localeCompare(b.projectTitle, 'ja'))

  return { completions, progress, nearCompletions, projectsWithoutGoals }
}
