import { getAppFactoryCandidates } from '@/lib/app-factory-candidates'
import { getOperationalDecisions } from '@/lib/operations-store'
import type { AppFactoryDecisionPoint, AppProposalOceanType } from '@/lib/app-factory-candidates'

export type AppProposalDecision = 'approved' | 'rejected' | 'held' | 'not_needed'

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
  overview?: string
  monetizationHypothesis: string
  marketValue?: string
  oceanType: AppProposalOceanType
  oceanRationale?: string
  monetizationPlan?: string
  winningFactors?: string[]
  concerns?: string[]
  spec?: string
  decisionPoints: AppFactoryDecisionPoint[]
  createdAt?: string
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

const PROJECT_SCREEN_TEMPLATES: Record<string, MockScreen[]> = {
  'shogi-kakoi-trainer': [
    { key: 'home', name: '囲い一覧', rows: ['美濃囲い', '矢倉囲い', '穴熊囲い', '舟囲い', '学習進捗', '今日の一問'] },
    { key: 'detail', name: '囲い詳細', rows: ['完成図', '手順1〜8手', '狙い・弱点', '類似の囲い', 'この囲いをテスト'] },
    { key: 'guide', name: '誘導モード', rows: ['盤面（現在）', '次の一手ハイライト', '▶次へ / ◀戻る', '残り手数', '最初から'] },
    { key: 'test', name: 'テスト', rows: ['囲い名を当てる', '4択', '正誤フィードバック', 'スコア'] },
    { key: 'record', name: '学習記録', rows: ['学習した囲い', '正答率', '連続学習日数', '苦手な囲い'] },
  ],
  mahjong: [
    { key: 'home', name: 'ホーム', rows: ['問題10問', '難易度フィルタ', 'タグフィルタ', 'ランダム開始', '直近の成績'] },
    { key: 'list', name: '問題一覧', rows: ['q001〜q010', '難易度バッジ', 'タグ', '解くボタン'] },
    { key: 'quiz', name: 'クイズ', rows: ['手牌（牌画）', 'ドラ・局', '選択肢A/B/C/D', '回答→正誤+解説'] },
    { key: 'result', name: '結果', rows: ['スコア%', '正解数', '問題別結果', 'もう一度/ホーム'] },
    { key: 'board', name: '牌盤ビュー', rows: ['自分の手牌', '河（捨て牌）', 'ドラ表示', '場風・自風'] },
  ],
  'ny-ai': [
    { key: 'quiz', name: '待ち牌クイズ', rows: ['手牌13枚', '待ち牌を選ぶ', '正誤判定', '解説'] },
    { key: 'list', name: '問題', rows: ['全5問', '天鳳牌譜ベース', '難易度'] },
    { key: 'result', name: 'スコア', rows: ['正答数', '待ち牌の種類別', 'もう一度'] },
  ],
  'ny01-news-app': [
    { key: 'list', name: 'ニュース一覧', rows: ['Dev.to/HN/Zenn/NHK', '翻訳済みタイトル', 'カテゴリ', '日付'] },
    { key: 'detail', name: '記事詳細', rows: ['要約', '原文リンク', 'タグ', '関連記事'] },
    { key: 'research', name: 'Research DB', rows: ['Topicカード', '重要度S/A/B/C', 'タイムライン', '重複候補'] },
    { key: 'tag', name: 'タグ検索', rows: ['#monetization', '#market-research', '#app-strategy', 'タグ別件数'] },
    { key: 'todo', name: 'ToDo化候補', rows: ['ToDo化 yes/no', '生成JSON', '承認→ゴール'] },
  ],
  'ny01-mahjong-analyzer': [
    { key: 'input', name: '牌譜入力', rows: ['牌譜を貼付', '形式選択', '解析開始'] },
    { key: 'result', name: '解析結果', rows: ['推奨打牌', '期待値', '危険度', '理由'] },
    { key: 'detail', name: '局面詳細', rows: ['手牌', '残り枚数', '待ち', '安全牌'] },
  ],
}

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

function normalizeStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, max)
}

function normalizeScreens(value: unknown, features: string[]): MockScreen[] {
  if (!Array.isArray(value)) return buildScreens(features)
  const screens = value
    .map((screen, index) => {
      if (!screen || typeof screen !== 'object') return null
      const source = screen as { key?: unknown; name?: unknown; rows?: unknown }
      const name = typeof source.name === 'string' && source.name.trim() ? source.name.trim() : `画面${index + 1}`
      const rows = normalizeStringArray(source.rows, 8)
      return {
        key: typeof source.key === 'string' && source.key.trim() ? source.key.trim() : `screen-${index + 1}`,
        name,
        rows: rows.length > 0 ? rows : rowsForScreen('detail', features),
      }
    })
    .filter((screen): screen is MockScreen => Boolean(screen))
    .slice(0, 5)
  return screens.length > 0 ? screens : buildScreens(features)
}

function screensForProject(projectId: string | null, features: string[]): MockScreen[] {
  if (projectId && PROJECT_SCREEN_TEMPLATES[projectId]) return PROJECT_SCREEN_TEMPLATES[projectId]
  return buildScreens(features)
}

function normalizeDecision(decision: string | undefined): AppProposalDecision | null {
  if (decision === 'approve' || decision === 'approved') return 'approved'
  if (decision === 'reject' || decision === 'rejected') return 'rejected'
  if (decision === 'hold' || decision === 'held') return 'held'
  if (decision === 'not_needed' || decision === 'skip_creation') return 'not_needed'
  return null
}

function fallbackOverview(purpose: string): string {
  return purpose.split(/[。.\n]/).map((part) => part.trim()).find(Boolean) ?? purpose
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
    const candidateFeatures = normalizeStringArray(candidate.features, 6)
    const features = candidateFeatures.length > 0 ? candidateFeatures : deriveFeatures(candidate.purpose)
    const latest = latestByTarget.get(candidate.id)
    const targetUser = candidate.targetUser?.trim() || deriveTargetUser(candidate.purpose)
    return {
      id: candidate.id,
      projectId: candidate.sourceProjectId,
      name: candidate.title,
      purpose: candidate.purpose,
      overview: candidate.overview?.trim() || fallbackOverview(candidate.purpose),
      monetizationHypothesis: candidate.monetizationHypothesis,
      marketValue: candidate.marketValue,
      oceanType: candidate.oceanType ?? 'unknown',
      oceanRationale: candidate.oceanRationale,
      monetizationPlan: candidate.monetizationPlan ?? candidate.monetizationHypothesis,
      winningFactors: normalizeStringArray(candidate.winningFactors, 8),
      concerns: normalizeStringArray(candidate.concerns, 8),
      spec: candidate.spec?.trim(),
      decisionPoints: candidate.decisionPoints ?? [],
      createdAt: candidate.createdAt,
      priority: candidate.priority,
      status: candidate.status,
      nextAction: candidate.nextAction,
      factorySafe: candidate.factorySafe,
      factoryNote: candidate.factoryNote,
      targetUser,
      features,
      screens: candidate.screens ? normalizeScreens(candidate.screens, features) : screensForProject(candidate.sourceProjectId, features),
      decision: latest?.decision ?? null,
      decisionNote: latest?.note,
    }
  })
}
