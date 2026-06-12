import { cache } from 'react'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { getEpics, getPendingApprovals } from '@/lib/operations-store'
import { readAppProgress, readProjectTasks } from '@/lib/progress-reader'
import { readGoals } from '@/lib/goal-reader'
import { readJson } from '@/lib/store'
import { readRevenueConfig } from '@/lib/revenue-config'
import type { RecommendedEpic } from '@/types/recommended-epic'
import type { ExecutionRunsData } from '@/types/execution-run'
import type { MonetizationCandidate } from '@/types/monetization'

// Page-rendering only cache wrappers. Do not import these from API routes or writers;
// write→read paths must use the raw readers so mutations are visible immediately.

export const readPageExecutionRuns = cache(readExecutionRuns)
export const readPageEpics = cache(getEpics)
export const readPagePendingApprovals = cache(getPendingApprovals)
export const readPageGoals = cache(readGoals)
export const readPageAppProgress = cache(readAppProgress)
export const readPageProjectTasks = cache(readProjectTasks)
export const readPageRevenueConfig = cache(readRevenueConfig)

export const readPageRecommendations = cache(() => readJson<RecommendedEpic[]>('recommended-epics.json', []))
export const readPageMonetizationCandidates = cache(() => readJson<MonetizationCandidate[]>('monetization-candidates.json', []))
export const readPageExecutionRunsData = cache(() => readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }))
