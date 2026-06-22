import { NextResponse } from 'next/server'
import { syncGoalMetricsFromFactory } from '@/lib/goal-metric-sync'

export const dynamic = 'force-dynamic'

// POST: computeFactoryMetrics の実測値で、機械計測できる Goal（closed_loop_rate 等）の current を更新する。
// Execution→Review→Knowledge→Next Epic ループの結果を Goal 達成度へ反映する手動トリガ。
export async function POST() {
  try {
    const result = await syncGoalMetricsFromFactory()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Failed to sync goal metrics:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
