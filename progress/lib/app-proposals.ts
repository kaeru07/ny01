import { getAppFactoryCandidates } from '@/lib/app-factory-candidates'
import { getOperationalDecisions } from '@/lib/operations-store'

export type AppProposalDecision = 'approved' | 'rejected' | 'held'

export interface MockScreen {
  key: string
  name: string
  rows: string[]
}

export interface AppProposal {
  id: string
  projectId: string | null
  name: string
  purpose: string
  monetizationHypothesis: string
  priority: string
  status: string
  nextAction: string
  factorySafe: boolean
  factoryNote?: string
  targetUser: string
  features: string[]
  screens: MockScreen[]
  decision?: AppProposalDecision | null
  decisionNote?: string
}

const DEFAULT_SCREEN_NAMES = [
  { key: 'home', name: 'ホーム' },
  { key: 'list', name: '一覧' },
  { key: 'detail', name: '詳細' },
  { key: 'create', name: '追加・記録' },
  { key: 'mypage', name: 'マイページ' },
]

const FALLBACK_FEATURES = ['状況確認', '記録', '一覧管理', '詳細確認', '設定']

function compactLabel(value: string): string {
  return value
    .replace(/[「」『』（）()[\]【】]/g, '')
    .replace(/\s+/g, '')
    .replace(/するための?|できる|します|です|ます/g, '')
    .slice(0, 18)
}

function deriveFeatures(purpose: string): string[] {
  const chunks = purpose
    .split(/[。、，,／/・\n]/)
    .map((part) => compactLabel(part))
    .filter((part) => part.length >= 2)

  const unique = Array.from(new Set(chunks))
  const features = unique.slice(0, 5)
  for (const fallback of FALLBACK_FEATURES) {
    if (features.length >= 2) break
    if (!features.includes(fallback)) features.push(fallback)
  }
  return features.slice(0, 5)
}

function deriveTargetUser(purpose: string): string {
  const patterns = [
    { re: /(?:経営者|オーナー|事業者|起業家)/, label: '事業オーナー' },
    { re: /(?:営業|商談|顧客|CRM)/i, label: '営業担当者' },
    { re: /(?:学習|勉強|受験|教育)/, label: '学習者' },
    { re: /(?:店舗|飲食|予約|来店)/, label: '店舗運営者' },
    { re: /(?:家計|投資|収益| monetization|売上|利益)/i, label: '収益を管理したいユーザー' },
    { re: /(?:タスク|TODO|todo|作業|進捗)/i, label: '作業を管理したいユーザー' },
    { re: /(?:AI|自動化|分析|レポート)/i, label: '業務を効率化したいユーザー' },
  ]
  return patterns.find((pattern) => pattern.re.test(purpose))?.label ?? '一般ユーザー'
}

function rowsForScreen(key: string, features: string[]): string[] {
  const primary = features.length > 0 ? features : FALLBACK_FEATURES
  const pools: Record<string, string[]> = {
    home: ['今日のサマリー', ...primary, '次のおすすめ'],
    list: [...primary.map((feature) => `${feature}リスト`), '最近更新', '未完了'],
    detail: ['概要', ...primary, 'メモ'],
    create: [...primary.map((feature) => `${feature}を入力`), '保存前チェック', '通知設定'],
    mypage: ['プロフィール', '利用状況', ...primary.slice(0, 2), '設定'],
  }
  const rows = pools[key] ?? primary
  return Array.from(new Set(rows)).slice(0, 5)
}

function buildScreens(features: string[]): MockScreen[] {
  return DEFAULT_SCREEN_NAMES.map((screen) => ({
    ...screen,
    rows: rowsForScreen(screen.key, features),
  }))
}

function normalizeDecision(decision: string | undefined): AppProposalDecision | null {
  if (decision === 'approve' || decision === 'approved') return 'approved'
  if (decision === 'reject' || decision === 'rejected') return 'rejected'
  if (decision === 'hold' || decision === 'held') return 'held'
  return null
}

export async function getAppProposals(): Promise<AppProposal[]> {
  const [queue, decisions] = await Promise.all([
    getAppFactoryCandidates(),
    getOperationalDecisions(),
  ])
  const latestByTarget = new Map<string, { decision: AppProposalDecision; note?: string }>()

  for (const entry of decisions) {
    if (entry.type !== 'app_proposal' || !entry.targetId) continue
    const decision = normalizeDecision(entry.decision)
    if (!decision) continue
    latestByTarget.set(entry.targetId, { decision, note: entry.note })
  }

  return queue.candidates.map((candidate) => {
    const features = deriveFeatures(candidate.purpose)
    const latest = latestByTarget.get(candidate.id)
    return {
      id: candidate.id,
      projectId: candidate.sourceProjectId,
      name: candidate.title,
      purpose: candidate.purpose,
      monetizationHypothesis: candidate.monetizationHypothesis,
      priority: candidate.priority,
      status: candidate.status,
      nextAction: candidate.nextAction,
      factorySafe: candidate.factorySafe,
      factoryNote: candidate.factoryNote,
      targetUser: deriveTargetUser(candidate.purpose),
      features,
      screens: buildScreens(features),
      decision: latest?.decision ?? null,
      decisionNote: latest?.note,
    }
  })
}
