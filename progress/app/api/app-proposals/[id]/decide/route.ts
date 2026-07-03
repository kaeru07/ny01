import { NextResponse } from 'next/server'
import { getAppFactoryCandidates } from '@/lib/app-factory-candidates'
import { ensureAppWorkspace, type AppWorkspaceResult } from '@/lib/app-workspace'
import { readGoals } from '@/lib/goal-reader'
import { upsertGoal, writeGoals } from '@/lib/goal-writer'
import { createApproval, getPendingApprovals, recordOperationalDecision } from '@/lib/operations-store'
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

const STORE_SUBMISSION_QUALITY_BAR = '完成条件: App Store/Google Playに提出できる品質（MVP全フロー完動・クラッシュゼロ・エラー/空状態処理・ストア素材と審査メタデータの準備まで）。提出・公開操作のみユーザーが行う。'

function appendStoreSubmissionQualityBar(text: string): string {
  const base = text.trim()
  if (base.includes(STORE_SUBMISSION_QUALITY_BAR)) return base
  return [base, STORE_SUBMISSION_QUALITY_BAR].filter(Boolean).join('\n\n')
}

// decisionPoints が空のアプリ案でも「作る」で必ず今日の判断に方針が並ぶよう、代表的な作成前方針をフォールバックとして使う。
const DEFAULT_DECISION_POINTS = [
  { key: 'platform', question: '最初に公開するストア対象は？', options: ['iOS', 'Android', 'iOS + Android', 'iPad対応'], required: true },
  // 技術スタックは成果物の形とCodemagicビルド設定を決める最重要判断。Flutterはこの実行環境に無いため選択肢に含めない。
  { key: 'framework', question: '技術スタックは？（ビルドはCodemagic前提）', options: ['Expo (React Native)', 'React Native CLI', 'Next.js (Web/PWA)'], required: true },
  { key: 'data_storage', question: 'データ保存先は？', options: ['端末内のみ', 'クラウド同期あり', '端末内 + 手動バックアップ'], required: true },
  { key: 'auth', question: '認証を入れる？', options: ['認証なし', 'Apple/Googleログイン', 'メールログイン'], required: true },
  { key: 'pricing', question: '最初の課金方式は？', options: ['無料MVP', '買い切り', '月額サブスク', '広告 + 課金解除'], required: false },
  { key: 'mvp_scope', question: 'MVP範囲はどこまでにする？', options: ['記録と一覧だけ', '通知まで含める', '分析まで含める', '課金導線まで含める'], required: false },
]

async function setGoalHoldForProject(projectId: string, hold: boolean): Promise<boolean> {
  const data = await readGoals()
  const goalIndex = data.goals.findIndex((goal) => goal.id === `goal-app-${projectId}`)
  const fallbackIndex = data.goals.findIndex((goal) => goal.projectId === projectId && goal.status === 'active')
  const targetIndex = goalIndex >= 0 ? goalIndex : fallbackIndex
  if (targetIndex === -1) return false
  const now = new Date().toISOString()
  data.goals[targetIndex] = {
    ...data.goals[targetIndex],
    queueControl: {
      ...data.goals[targetIndex].queueControl,
      hold,
      updatedBy: 'user',
      updatedAt: now,
    },
    updatedAt: now,
  }
  await writeGoals(data)
  return true
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
    let requiredCount = 0
    let workspace: AppWorkspaceResult | null | undefined
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
          workspace = await ensureAppWorkspace(projectId, candidate.title)
          if (!workspace) warnings.push(`workspace create skipped: invalid projectId ${projectId}`)
        } catch (error) {
          warnings.push(`workspace create failed: ${error instanceof Error ? error.message : String(error)}`)
        }

        try {
          // 決定を2回押しても同じゴールを更新する（projectId基準の固定id）。id未指定だと毎回新規作成され二重化する。
          const goal = await upsertGoal({
            id: `goal-app-${projectId}`,
            title: `${candidate.title}を作る`,
            summary: appendStoreSubmissionQualityBar(candidate.purpose),
            description: appendStoreSubmissionQualityBar(candidate.purpose),
            projectId,
            status: 'active',
            decisionPolicyDefault: 'autonomous',
            riskFlagsDefault: candidate.riskFlags ?? [],
            priority: candidate.priority,
            monetizationImpact: impactFromPriority(candidate.priority),
            notes: note || undefined,
          })
          goalId = goal.id
        } catch (error) {
          warnings.push(`goal create failed: ${error instanceof Error ? error.message : String(error)}`)
        }

        const decisionPoints = (candidate.decisionPoints && candidate.decisionPoints.length > 0)
          ? candidate.decisionPoints
          : DEFAULT_DECISION_POINTS
        // 決定を2回押しても同じ方針項目を重複追加しない（projectId+タイトルで既存pendingを判定）。
        const existingApprovals = await getPendingApprovals()
        for (const point of decisionPoints) {
          try {
            const title = `${candidate.title}: ${point.question}`
            const existing = existingApprovals.find((a) => a.projectId === projectId && a.title === title)
            if (existing) {
              if (point.required === true && existing.requiredForExecution) requiredCount += 1
              continue
            }
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
              title,
              options,
              recommended: options[0]?.key ?? 'decide',
              reason: 'アプリ案決定時に方針決定が必要な項目',
              requiredForExecution: point.required === true,
            })
            approvalCount += 1
            if (point.required === true) requiredCount += 1
          } catch (error) {
            warnings.push(`approval create failed (${point.key}): ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        if (projectId && requiredCount > 0) {
          const held = await setGoalHoldForProject(projectId, true)
          if (!held) warnings.push(`goal hold failed: ${projectId}`)
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
    return NextResponse.json({ success: true, goalId, projectId, workspace, approvalCount, requiredCount, warnings })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'failed to record decision' },
      { status: 500 },
    )
  }
}
