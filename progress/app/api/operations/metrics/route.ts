import { NextResponse } from 'next/server'
import { computeFactoryMetrics } from '@/lib/factory-metrics'
import { buildQueueSplit } from '@/lib/queue-split'

export const dynamic = 'force-dynamic'

// GET: Factory運用メトリクス + Human/AI Queue 分離ビュー（既存正本からの都度算出・書き込みなし）。
export async function GET() {
  try {
    const [metrics, queues] = await Promise.all([computeFactoryMetrics(), buildQueueSplit()])
    return NextResponse.json({ metrics, queues })
  } catch (err) {
    console.error('Failed to compute factory metrics:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
