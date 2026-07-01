import { NextResponse } from 'next/server'
import { getAppFactoryCandidates } from '@/lib/app-factory-candidates'
import { upsertGoal } from '@/lib/goal-writer'
import { createApproval, recordOperationalDecision } from '@/lib/operations-store'
import { addProject } from '@/lib/progress-writer'
import type { CandidatePriority } from '@/lib/app-factory-candidates'

const decisions = ['approve', 'reject', 'hold', 'not_needed'] as const
type Decision = (typeof decisions)[number]

function isDecision(value: unknown): value is Decision {
  return typeof value === 'string' && decisions.includes(value as Decision)
}

function slug(input: string): string {
  const ascii = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  if (ascii) return ascii
  return Buffer.from(input).toString('hex').slice(0, 32) || `app-${Date.now().toString(36)}`
}

function impactFromPriority(priority: CandidatePriority): 'high' | 'medium' | 'low' {
  if (priority === 'high') return 'high'
  if (priority === 'low') return 'low'
  return 'medium'
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 })
  }

  const payload = body as { decision?: unknown; note?: unknown }
  if (!isDecision(payload.decision)) {
    return NextResponse.json({ success: false, error: 'decision must be approve, reject, hold, or not_needed' }, { status: 400 })
  }

  const note = typeof payload.note === 'string' ? payload.note.trim() : undefined

  try {
    let goalId: string | undefined
    let projectId: string | undefined
    let approvalCount = 0
    const warnings: string[] = []

    if (payload.decision === 'approve') {
      const queue = await getAppFactoryCandidates()
      const candidate = queue.candidates.find((item) => item.id === id)
      if (!candidate) {
        warnings.push(`candidate not found: ${id}`)
      } else {
        projectId = candidate.sourceProjectId ?? slug(candidate.id || candidate.title)
        try {
          await addProject({
            id: projectId,
            name: candidate.title,
            status: 'active',
            phase: '計画',
            progress: 0,
            currentTask: `${candidate.title} 初期設計`,
            nextAction: '自動実行で次の一歩を進める',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (!message.includes('DUPLICATE_ID')) warnings.push(`project create failed: ${message}`)
        }

        try {
          const goal = await upsertGoal({
            title: `${candidate.title}を作る`,
            summary: candidate.purpose,
            description: candidate.purpose,
            projectId,
            status: 'active',
            decisionPolicyDefault: 'autonomous',
            riskFlagsDefault: [],
            priority: candidate.priority,
            monetizationImpact: impactFromPriority(candidate.priority),
          })
          goalId = goal.id
        } catch (error) {
          warnings.push(`goal create failed: ${error instanceof Error ? error.message : String(error)}`)
        }

        for (const point of candidate.decisionPoints ?? []) {
          try {
            const options = point.options && point.options.length > 0
              ? point.options.map((option, index) => ({ key: slug(`${point.key}-${index}-${option}`), label: option }))
              : [
                  { key: 'decide', label: '方針を決める' },
                  { key: 'later', label: '後で' },
                  { key: 'ai', label: 'AIに任せる' },
                ]
            await createApproval({
              projectId,
              category: 'multi_option',
              title: `${candidate.title}: ${point.question}`,
              options,
              recommended: options[0]?.key ?? 'decide',
              reason: 'アプリ案決定時に方針決定が必要な項目',
            })
            approvalCount += 1
          } catch (error) {
            warnings.push(`approval create failed (${point.key}): ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    }

    await recordOperationalDecision({
      type: 'app_proposal',
      targetId: id,
      action: payload.decision,
      topic: `App proposal: ${id}`,
      decision: payload.decision,
      note,
      source: 'app-proposals-page',
    })
    return NextResponse.json({ success: true, goalId, projectId, approvalCount, warnings })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'failed to record decision' },
      { status: 500 },
    )
  }
}
