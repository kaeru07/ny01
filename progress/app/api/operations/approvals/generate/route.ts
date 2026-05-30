import { NextResponse } from 'next/server'
import { createApproval } from '@/lib/operations-store'
import type { ApprovalCategory, ApprovalPriority } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES: ApprovalCategory[] = [
  'goal_change',
  'billing',
  'destructive',
  'production_risk',
  'secret',
  'external_publish',
  'monetization',
  'multi_option',
  'executor_fallback',
]
const VALID_PRIORITIES: ApprovalPriority[] = ['critical', 'high', 'normal', 'low']

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 })
  }
  if (!Array.isArray(body.options) || body.options.length < 2) {
    return NextResponse.json({ success: false, error: 'options must contain at least 2 choices' }, { status: 400 })
  }

  const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'multi_option'
  const priority = VALID_PRIORITIES.includes(body.priority) ? body.priority : 'normal'
  const options = body.options
    .slice(0, 4)
    .map((opt: Record<string, unknown>, index: number) => ({
      key: typeof opt.key === 'string' && opt.key.trim() ? opt.key.trim() : String.fromCharCode(65 + index),
      label: typeof opt.label === 'string' && opt.label.trim() ? opt.label.trim() : `Option ${index + 1}`,
      detail: typeof opt.detail === 'string' ? opt.detail : undefined,
      flag: typeof opt.flag === 'string' ? opt.flag as 'billing' | 'destructive' | 'secret' | 'external_publish' : undefined,
    }))
  const recommended = typeof body.recommended === 'string' && options.some((o: { key: string }) => o.key === body.recommended)
    ? body.recommended
    : options[0].key

  const approval = await createApproval({
    epicId: typeof body.epicId === 'string' ? body.epicId : undefined,
    title: body.title.trim(),
    category,
    priority,
    options,
    recommended,
    reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'executorが判断不能になったため',
    createdRunId: typeof body.createdRunId === 'string' ? body.createdRunId : undefined,
  })

  return NextResponse.json({ success: true, approval })
}
