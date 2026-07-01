import { addAppFactoryCandidate, getAppFactoryCandidates, type AppFactoryCandidate, type AppProposalOceanType } from '@/lib/app-factory-candidates'
import { appendAutomationLog } from '@/lib/operations-store'
import { buildResearchGoalCandidates } from '@/lib/research-goals'
import { getKnowledgeRecords } from '@/lib/knowledge-loop'
import { runCommand } from '@/lib/executors/shell'

export interface DailyAppProposalResult {
  generated: boolean
  reason: string
  candidateId?: string
  candidateIds: string[]
}

interface ProposalSeed {
  title: string
  summary: string
  source: string
}

interface AiScreen {
  name: string
  rows: string[]
}

interface AiDecisionPoint {
  key: string
  question: string
  options?: string[]
}

interface AiStoreAppProposal {
  title: string
  overview: string
  purpose: string
  targetUser: string
  features: string[]
  screens: AiScreen[]
  marketValue: string
  oceanType: AppProposalOceanType
  oceanRationale: string
  monetizationHypothesis: string
  monetizationPlan: string
  winningFactors: string[]
  concerns: string[]
  spec: string
  decisionPoints: AiDecisionPoint[]
}

const AI_TIMEOUT_MS = 90_000
const MAX_AI_PROPOSALS = 3

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

function compactText(value: unknown, fallback: string, max = 800): string {
  if (typeof value !== 'string') return fallback
  const text = value.trim()
  return (text || fallback).slice(0, max)
}

function stringList(value: unknown, fallback: string[], max = 8): string[] {
  const items = Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
    : []
  return (items.length > 0 ? items : fallback).slice(0, max)
}

function normalizeOceanType(value: unknown): AppProposalOceanType {
  return value === 'blue' || value === 'red' ? value : 'unknown'
}

async function collectSeeds(): Promise<ProposalSeed[]> {
  const research = await buildResearchGoalCandidates({ maxDays: 7, max: 3 }).catch(() => [])
  const researchSeeds: ProposalSeed[] = research.map((item) => ({
    title: item.title,
    summary: item.summary ?? item.enables ?? item.title,
    source: 'research',
  }))

  const knowledge = await getKnowledgeRecords().catch(() => [])
  const knowledgeSeeds: ProposalSeed[] = knowledge
    .slice()
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      summary: item.summary || item.nextActions[0] || item.title,
      source: 'knowledge',
    }))

  const seeds = [...researchSeeds, ...knowledgeSeeds].filter((seed) => seed.title.trim())
  if (seeds.length > 0) return seeds.slice(0, 6)

  return [{
    title: '今日の小さな業務改善',
    summary: '直近の調査・Knowledge から明確な種が取れなかったため、今日の判断で要精査の汎用アプリ案として生成。',
    source: 'template',
  }]
}

function buildAiPrompt(seeds: ProposalSeed[]): string {
  const seedBlock = seeds.map((seed, index) => ({
    index: index + 1,
    source: seed.source,
    title: seed.title,
    summary: seed.summary.slice(0, 500),
  }))

  return [
    'App Store / Google Play で公開・ダウンロード・収益化できるモバイルアプリ案を1〜3件出してください。',
    'Webアプリを主軸にしないでください。既定プラットフォームは iOS / Android です。',
    '直近の research / knowledge を種として、ストア公開前提の具体的な勝ち筋・市場・仕様に落とし込んでください。',
    '各案は単なる「支援アプリ」ではなく、ユーザーがストアで探してインストールする理由が明確なものにしてください。',
    '必ず次のJSON配列だけを返してください。前後に説明文、Markdown、コードフェンスを付けないでください。',
    '',
    JSON.stringify([{
      title: 'アプリ名',
      overview: '1行概要',
      purpose: '何を解決するか',
      targetUser: '具体的な利用者',
      features: ['主要機能1', '主要機能2', '主要機能3'],
      screens: [
        { name: 'ホーム', rows: ['表示要素', '操作', '状態'] },
        { name: '記録', rows: ['入力項目', '保存前チェック'] },
        { name: '一覧', rows: ['カード', '検索', '絞り込み'] },
        { name: '詳細', rows: ['分析', '次アクション'] },
      ],
      marketValue: 'ストア公開時の需要・支払い意思・競合状況',
      oceanType: 'blue',
      oceanRationale: 'blue または red の判断根拠',
      monetizationHypothesis: '誰が何に払うか',
      monetizationPlan: 'ストア課金前提: 買い切り/サブスク/アプリ内課金/広告のどれで検証するか',
      winningFactors: ['勝機1', '勝機2', '勝機3'],
      concerns: ['懸念1', '懸念2'],
      spec: '詳細仕様。機能、画面遷移、データ、通知、オフライン、技術前提などの要約。',
      decisionPoints: [
        { key: 'platform', question: '最初に公開するストア対象は？', options: ['iOS', 'Android', 'iOS + Android', 'iPad対応'] },
        { key: 'pricing', question: '最初の課金方式は？', options: ['買い切り', '月額サブスク', 'アプリ内課金', '広告 + 課金解除'] },
      ],
    }], null, 2),
    '',
    '制約:',
    '- screens はモバイル画面を4〜5枚にする。',
    "- oceanType は 'blue' または 'red' のみ。",
    '- monetizationPlan は必ず App Store / Google Play の課金・広告モデルにする。',
    '- decisionPoints の platform 選択肢に Web を入れない。',
    '',
    '直近の種:',
    JSON.stringify(seedBlock, null, 2),
  ].join('\n')
}

function extractJsonArray(text: string): unknown {
  const start = text.indexOf('[')
  if (start < 0) throw new Error('json_array_not_found')

  let inString = false
  let escape = false
  let depth = 0
  for (let i = start; i < text.length; i += 1) {
    const char = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = inString
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1))
      }
    }
  }
  throw new Error('json_array_unclosed')
}

function normalizeScreens(value: unknown): AiScreen[] {
  if (!Array.isArray(value)) return []
  return value
    .map((screen) => {
      if (!screen || typeof screen !== 'object') return null
      const source = screen as { name?: unknown; rows?: unknown }
      const name = compactText(source.name, '', 40)
      const rows = stringList(source.rows, [], 8)
      if (!name || rows.length === 0) return null
      return { name, rows }
    })
    .filter((screen): screen is AiScreen => Boolean(screen))
    .slice(0, 5)
}

function normalizeDecisionPoints(value: unknown): AiDecisionPoint[] {
  if (!Array.isArray(value)) return []
  const points: AiDecisionPoint[] = []
  for (const point of value) {
    if (!point || typeof point !== 'object') continue
    const source = point as { key?: unknown; question?: unknown; options?: unknown }
    const key = compactText(source.key, '', 40)
    const question = compactText(source.question, '', 120)
    if (!key || !question) continue
    points.push({ key, question, options: stringList(source.options, [], 6) })
    if (points.length >= 6) break
  }
  return points
}

function normalizeAiProposal(value: unknown): AiStoreAppProposal | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Record<string, unknown>
  const title = compactText(source.title, '', 80)
  const purpose = compactText(source.purpose, '', 900)
  if (!title || !purpose) return null

  const features = stringList(source.features, ['記録', '分析', '通知', '履歴'], 6)
  const screens = normalizeScreens(source.screens)
  const decisionPoints = normalizeDecisionPoints(source.decisionPoints)

  return {
    title,
    overview: compactText(source.overview, purpose.split(/[。.\n]/).find(Boolean) ?? purpose, 160),
    purpose,
    targetUser: compactText(source.targetUser, 'App Store / Google Play で課題解決アプリを探す一般ユーザー', 120),
    features,
    screens: screens.length > 0 ? screens : [
      { name: 'ホーム', rows: ['今日の状態', features[0] ?? '主要機能', '次のおすすめ'] },
      { name: '記録', rows: ['入力フォーム', '保存前チェック', '通知設定'] },
      { name: '一覧', rows: ['最近の記録', '検索', '絞り込み'] },
      { name: '詳細', rows: ['分析結果', 'メモ', '次アクション'] },
    ],
    marketValue: compactText(source.marketValue, 'App Store / Google Play 上の需要、競合、支払い意思は今日の判断で要精査。', 600),
    oceanType: normalizeOceanType(source.oceanType),
    oceanRationale: compactText(source.oceanRationale, '競合密度と差別化余地は今日の判断で要精査。', 600),
    monetizationHypothesis: compactText(source.monetizationHypothesis, 'ストアユーザーが継続的な課題解決に対して課金する仮説。', 400),
    monetizationPlan: compactText(source.monetizationPlan, 'App Store / Google Play の買い切り、サブスク、アプリ内課金、広告のいずれかで検証する。', 700),
    winningFactors: stringList(source.winningFactors, ['今日の判断で要精査'], 8),
    concerns: stringList(source.concerns, ['今日の判断で要精査'], 8),
    spec: compactText(source.spec, '詳細仕様は今日の判断で要精査。モバイル画面、通知、データ保存、ストア課金を前提に詰める。', 1200),
    decisionPoints: decisionPoints.length > 0 ? decisionPoints : [
      { key: 'platform', question: '最初に公開するストア対象は？', options: ['iOS', 'Android', 'iOS + Android', 'iPad対応'] },
      { key: 'pricing', question: '最初の課金方式は？', options: ['買い切り', '月額サブスク', 'アプリ内課金', '広告 + 課金解除'] },
    ],
  }
}

async function runProposalCli(prompt: string): Promise<{ source: 'ai'; proposals: AiStoreAppProposal[]; reason: string } | { source: 'fallback'; proposals: []; reason: string }> {
  if (process.env.APP_PROPOSAL_DRY_RUN === '1' || process.env.APP_PROPOSAL_DRY_RUN === 'true') {
    return { source: 'fallback', proposals: [], reason: 'dry-run' }
  }

  const claudeBin = process.env.CLAUDE_BIN ?? 'claude'
  const codexBin = process.env.CODEX_BIN ?? 'codex'
  const attempts = [
    { name: 'claude', cmd: claudeBin, args: ['-p', prompt] },
    { name: 'codex', cmd: codexBin, args: ['exec', '-C', process.cwd(), '--skip-git-repo-check', '-s', 'workspace-write', prompt] },
  ] as const

  const reasons: string[] = []
  for (const attempt of attempts) {
    const result = await runCommand(attempt.cmd, [...attempt.args], { cwd: process.cwd(), timeoutMs: AI_TIMEOUT_MS })
    if (result.timedOut) {
      reasons.push(`${attempt.name}:timeout`)
      continue
    }
    if (result.code !== 0) {
      reasons.push(`${attempt.name}:exit_${result.code ?? 'null'}`)
      continue
    }
    try {
      const raw = extractJsonArray(result.stdout)
      const normalized = Array.isArray(raw)
        ? raw.map(normalizeAiProposal).filter((item): item is AiStoreAppProposal => Boolean(item)).slice(0, MAX_AI_PROPOSALS)
        : []
      if (normalized.length > 0) {
        return { source: 'ai', proposals: normalized, reason: attempt.name }
      }
      reasons.push(`${attempt.name}:empty_valid_json`)
    } catch (error) {
      reasons.push(`${attempt.name}:${error instanceof Error ? error.message : 'parse_failed'}`)
    }
  }

  return { source: 'fallback', proposals: [], reason: reasons.join(', ') || 'ai_unavailable' }
}

function priorityForProposal(proposal: AiStoreAppProposal): AppFactoryCandidate['priority'] {
  if (proposal.oceanType === 'blue' && proposal.winningFactors.length >= proposal.concerns.length) return 'high'
  return 'medium'
}

function toCandidate(proposal: AiStoreAppProposal, index: number, now: string): AppFactoryCandidate {
  const id = `daily-${todayJst()}-${index + 1}-${safeSlug(proposal.title)}`.slice(0, 80)
  return {
    id,
    title: proposal.title,
    sourceProjectId: null,
    overview: proposal.overview,
    purpose: proposal.purpose,
    targetUser: proposal.targetUser,
    features: proposal.features,
    screens: proposal.screens.map((screen, screenIndex) => ({
      key: `screen-${screenIndex + 1}`,
      name: screen.name,
      rows: screen.rows,
    })),
    marketValue: proposal.marketValue,
    oceanType: proposal.oceanType,
    oceanRationale: proposal.oceanRationale,
    monetizationHypothesis: proposal.monetizationHypothesis,
    monetizationPlan: proposal.monetizationPlan,
    winningFactors: proposal.winningFactors,
    concerns: proposal.concerns,
    spec: proposal.spec,
    priority: priorityForProposal(proposal),
    status: 'proposed',
    nextAction: 'ストア公開対象、課金方式、MVP機能、審査リスクを今日の判断で決める',
    factorySafe: false,
    factoryNote: 'App Store / Google Play 公開前提の自動生成案。方針決定とストア審査観点の確認後に Factory 対象化する。',
    decisionPoints: proposal.decisionPoints,
    createdAt: now,
  }
}

function fallbackProposal(seed: ProposalSeed): AiStoreAppProposal {
  const baseTitle = seed.title.replace(/を(試す|調査する)$/, '').trim() || seed.title
  const title = `${baseTitle}モバイル`
  const summary = seed.summary.slice(0, 180)
  return {
    title,
    overview: `${seed.source} 起点のストア公開前提モバイルアプリ案。今日の判断で要精査。`,
    purpose: `${summary} をもとに、iOS / Android ユーザーが日常的に記録・判断・次アクション化できるストア公開アプリを作る。`,
    targetUser: 'App Store / Google Play で課題解決アプリを探す iOS / Android ユーザー',
    features: ['クイック記録', '一覧と検索', '判断メモ', 'リマインダー', '課金プラン管理'],
    screens: [
      { name: 'ホーム', rows: ['今日のサマリー', '未処理の記録', '次のおすすめ', 'プレミアム導線'] },
      { name: '記録', rows: ['入力フォーム', 'テンプレート選択', '保存前チェック', '通知設定'] },
      { name: '一覧', rows: ['履歴カード', '検索', 'タグ絞り込み', '重要度バッジ'] },
      { name: '詳細', rows: ['要約', '判断メモ', '次アクション', '共有'] },
      { name: '設定', rows: ['iOS / Android 通知', 'サブスク状態', 'データ管理', 'ストアレビュー導線'] },
    ],
    marketValue: `${seed.source} 由来の需要仮説。App Store / Google Play で類似カテゴリ、検索語、価格帯、レビュー不満、支払い意思を今日の判断で要精査。`,
    oceanType: 'unknown',
    oceanRationale: 'ストア競合密度、レビュー不満、差別化可能なワークフローは未調査。今日の判断で要精査。',
    monetizationHypothesis: '無料インストールで利用開始し、継続利用・通知・テンプレート・分析の価値に対してストア課金する仮説。',
    monetizationPlan: 'App Store / Google Play のアプリ内課金を前提に、無料枠 + 月額サブスクを第一候補、必要に応じて買い切り解除または広告 + 課金解除を検証する。',
    winningFactors: ['今日の判断で要精査', 'iOS / Android の日常利用導線に載せられる可能性', 'ストアレビュー不満から差別化余地を探せる'],
    concerns: ['今日の判断で要精査', 'ストア競合・審査リスク・継続率が未検証', '課金価値が弱い場合は広告依存になりやすい'],
    spec: '詳細仕様は今日の判断で要精査。iOS / Android 対応、ローカル保存 + 任意クラウド同期、プッシュ通知、App Store / Google Play のアプリ内課金、ストア審査に通るデータ・プライバシー表示を前提にMVPを定義する。',
    decisionPoints: [
      { key: 'platform', question: '最初に公開するストア対象は？', options: ['iOS', 'Android', 'iOS + Android', 'iPad対応'] },
      { key: 'pricing', question: '最初の課金方式は？', options: ['無料 + 月額サブスク', '買い切り', 'アプリ内課金', '広告 + 課金解除'] },
      { key: 'mvp', question: '最小機能セットはどこまでにする？', options: ['記録と一覧だけ', '通知まで含める', '分析まで含める'] },
    ],
  }
}

export async function generateStoreAppProposalsViaAI(seeds: ProposalSeed[]): Promise<{ proposals: AiStoreAppProposal[]; mode: 'ai' | 'fallback'; reason: string }> {
  const prompt = buildAiPrompt(seeds)
  const ai = await runProposalCli(prompt)
  if (ai.source === 'ai' && ai.proposals.length > 0) {
    return { proposals: ai.proposals, mode: 'ai', reason: ai.reason }
  }
  return { proposals: [fallbackProposal(seeds[0])], mode: 'fallback', reason: ai.reason }
}

export async function ensureDailyAppProposal(): Promise<DailyAppProposalResult> {
  const queue = await getAppFactoryCandidates()
  const existing = queue.candidates.find((candidate) => isTodayJst(candidate.createdAt))
  if (existing) {
    return {
      generated: false,
      reason: 'today proposal already exists',
      candidateId: existing.id,
      candidateIds: [existing.id],
    }
  }

  const seeds = await collectSeeds()
  const now = new Date().toISOString()
  const generated = await generateStoreAppProposalsViaAI(seeds)
  const candidates = generated.proposals.slice(0, MAX_AI_PROPOSALS).map((proposal, index) => toCandidate(proposal, index, now))

  const candidateIds: string[] = []
  for (const candidate of candidates.length > 0 ? candidates : [toCandidate(fallbackProposal(seeds[0]), 0, now)]) {
    await addAppFactoryCandidate(candidate)
    candidateIds.push(candidate.id)
  }

  await appendAutomationLog({
    event: 'app_proposal_generated',
    fallbackReason: `mode=${generated.mode} count=${candidateIds.length} reason=${generated.reason}`,
    fallbackTarget: candidateIds.join(','),
  })

  return {
    generated: true,
    reason: `${generated.mode} generated (${generated.reason})`,
    candidateId: candidateIds[0],
    candidateIds,
  }
}
