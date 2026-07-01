import { addAppFactoryCandidate, getAppFactoryCandidates, type AppFactoryCandidate } from '@/lib/app-factory-candidates'
import { appendAutomationLog } from '@/lib/operations-store'
import { buildResearchGoalCandidates } from '@/lib/research-goals'
import { getKnowledgeRecords } from '@/lib/knowledge-loop'

export interface DailyAppProposalResult {
  generated: boolean
  reason: string
  candidateId?: string
}

function todayJst(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function isTodayJst(iso?: string): boolean {
  if (!iso) return false
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  return todayJst(date) === todayJst()
}

function safeSlug(input: string): string {
  const ascii = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  if (ascii) return ascii
  return Buffer.from(input).toString('hex').slice(0, 28) || 'daily-app'
}

async function pickSeed(): Promise<{ title: string; summary: string; source: string }> {
  const research = await buildResearchGoalCandidates({ maxDays: 7, max: 1 }).catch(() => [])
  const firstResearch = research[0]
  if (firstResearch) {
    return {
      title: firstResearch.title,
      summary: firstResearch.summary ?? firstResearch.enables ?? firstResearch.title,
      source: 'research',
    }
  }

  const knowledge = await getKnowledgeRecords().catch(() => [])
  const latest = knowledge.slice().sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0]
  if (latest) {
    return {
      title: latest.title,
      summary: latest.summary || latest.nextActions[0] || latest.title,
      source: 'knowledge',
    }
  }

  return {
    title: '今日の小さな業務改善',
    summary: '直近の調査・Knowledge から明確な種が取れなかったため、今日の判断で要精査の汎用アプリ案として生成。',
    source: 'template',
  }
}

export async function ensureDailyAppProposal(): Promise<DailyAppProposalResult> {
  const queue = await getAppFactoryCandidates()
  const existing = queue.candidates.find((candidate) => isTodayJst(candidate.createdAt))
  if (existing) {
    return { generated: false, reason: 'today proposal already exists', candidateId: existing.id }
  }

  const seed = await pickSeed()
  const now = new Date().toISOString()
  const baseSlug = safeSlug(seed.title)
  const id = `daily-${todayJst()}-${baseSlug}`.slice(0, 80)
  const appName = `${seed.title.replace(/を(試す|調査する)$/, '')}支援アプリ`
  const summary = seed.summary.slice(0, 180)
  const candidate: AppFactoryCandidate = {
    id,
    title: appName,
    sourceProjectId: null,
    overview: `${seed.source} 起点のアプリ案。今日の判断で要精査。`,
    purpose: `${summary} をもとに、ユーザーが具体的な判断・記録・次アクション化を行える小さなアプリを作る。`,
    marketValue: `${seed.source} 由来の需要仮説。市場規模・競合・支払い意思は今日の判断で要精査。`,
    oceanType: 'unknown',
    oceanRationale: '自動生成時点では競合密度を未調査。今日の判断で要精査。',
    monetizationHypothesis: 'まず無料MVPで利用価値を確認し、継続利用が見えたら有料テンプレート、月額、広告の順に検証する。',
    monetizationPlan: 'MVP公開後に利用ログと継続率を確認。価値が高い操作を有料枠に分離し、月額または買い切りテンプレートとして検証する。今日の判断で要精査。',
    priority: 'medium',
    status: 'proposed',
    nextAction: '今日の判断で対象プラットフォーム・課金方式・最小機能セットを決める',
    factorySafe: false,
    factoryNote: '自動生成案のため、方針決定後に Factory 対象化する。',
    decisionPoints: [
      { key: 'platform', question: '最初に作る対象プラットフォームは？', options: ['Web', 'iOS', 'Android'] },
      { key: 'pricing', question: '最初の課金方式は？', options: ['無料MVP', '買い切り', '月額'] },
      { key: 'mvp', question: '最小機能セットはどこまでにする？', options: ['記録と一覧だけ', '分析まで含める', '共有まで含める'] },
    ],
    createdAt: now,
  }

  await addAppFactoryCandidate(candidate)
  await appendAutomationLog({
    event: 'app_proposal_generated',
    fallbackReason: `candidateId=${candidate.id} source=${seed.source}`,
    fallbackTarget: candidate.title,
  })
  return { generated: true, reason: `generated from ${seed.source}`, candidateId: candidate.id }
}
