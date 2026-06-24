import { computeFactoryMetrics, type FactoryMetrics } from '@/lib/factory-metrics'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'
import { countValidatedProjectCandidates } from '@/lib/monetization-store'

// Execution→Review→Knowledge→Next Epic ループの「結果」を Goal の current 値へ反映する。
// closedLoopRate などの実測メトリクスは computeFactoryMetrics で都度算出されるが、
// goals.json の current は手動編集のまま放置されると実態とずれる（例: 実測24% / 表示10%）。
// metric 名で機械計測できる Goal だけ current を自動更新し、ループの達成度を可視化する。
// ※ metric が 'progress' 等の手動指標の Goal は対象外（手動編集を上書きしない）。

export interface GoalMetricSyncUpdate {
  goalId: string
  metric: string
  previous: number
  next: number
}

export interface GoalMetricSyncResult {
  updated: GoalMetricSyncUpdate[]
  skipped: number
  computedAt: string
}

// metric 名 → 0〜100 スケールの実測値（target も 0〜100 前提）。
// 計測できない metric は null を返し、その Goal はスキップする。
export function metricValueFor(
  metric: string | undefined,
  metrics: FactoryMetrics,
  extra: { validatedProjectCount?: number } = {},
): number | null {
  switch (metric) {
    case 'closed_loop_rate':
      // command-center と同じ式（パーセント・小数1桁）。
      return Math.round(metrics.closedLoopRate * 1000) / 10
    case 'validated_project_count':
      return typeof extra.validatedProjectCount === 'number' ? extra.validatedProjectCount : null
    default:
      return null
  }
}

/** computeFactoryMetrics の実測値で、機械計測できる Goal の current を更新する。 */
export async function syncGoalMetricsFromFactory(metrics?: FactoryMetrics): Promise<GoalMetricSyncResult> {
  const computed = metrics ?? (await computeFactoryMetrics())
  const validatedProjectCount = await countValidatedProjectCandidates()
  const data = await readGoals()
  const now = new Date().toISOString()
  const updated: GoalMetricSyncUpdate[] = []
  let skipped = 0
  let changed = false

  for (const goal of data.goals) {
    const next = metricValueFor(goal.metric, computed, { validatedProjectCount })
    if (next === null) {
      skipped += 1
      continue
    }
    const previous = typeof goal.current === 'number' ? goal.current : 0
    // 0.05pt 未満の差は書き込みしない（毎定時の無意味な diff を防ぐ）。
    if (Math.abs(previous - next) < 0.05) {
      goal.metricSyncedAt = now
      skipped += 1
      changed = true
      continue
    }
    goal.current = next
    goal.metricSyncedAt = now
    goal.updatedAt = now
    updated.push({ goalId: goal.id, metric: goal.metric ?? '', previous, next })
    changed = true
  }

  if (changed) await writeGoals(data)
  return { updated, skipped, computedAt: now }
}
