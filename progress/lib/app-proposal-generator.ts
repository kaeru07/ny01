import { addAppFactoryCandidate, getAppFactoryCandidates, type AppFactoryCandidate, type AppProposalDifficulty, type AppProposalOceanType } from '@/lib/app-factory-candidates'
import { appendAutomationLog } from '@/lib/operations-store'
import { buildResearchGoalCandidates } from '@/lib/research-goals'
import { readAiNewsSeed, readMarketResearchSeed, type AiNewsSeed, type MarketResearchSeed } from '@/lib/research-seed-reader'
import { getKnowledgeRecords } from '@/lib/knowledge-loop'
import { runCommand } from '@/lib/executors/shell'
import type { EpicRiskFlag } from '@/lib/types/operations'

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

interface MarketObservationSeed {
  market: MarketResearchSeed | null
  aiNews: AiNewsSeed | null
}

interface AiScreen {
  name: string
  rows: string[]
}

interface AiDecisionPoint {
  key: string
  question: string
  options?: string[]
  required?: boolean
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
  riskFlags: EpicRiskFlag[]
  spec: string
  decisionPoints: AiDecisionPoint[]
  mvpScope?: string
  difficulty?: AppProposalDifficulty
  externalApis?: string[]
  initialGoalDraft?: string
}

const AI_TIMEOUT_MS = 90_000
const MAX_AI_PROPOSALS = 3
const VALID_RISK_FLAGS: EpicRiskFlag[] = ['billing', 'production_db', 'auth_secret', 'deploy', 'migration', 'destructive', 'external_publish']

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

function normalizeDifficulty(value: unknown): AppProposalDifficulty | undefined {
  return value === 'low' || value === 'medium' || value === 'high' ? value : undefined
}

function normalizeRiskFlags(value: unknown): EpicRiskFlag[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is EpicRiskFlag => VALID_RISK_FLAGS.includes(item as EpicRiskFlag))))
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

async function collectMarketObservationSeed(): Promise<MarketObservationSeed> {
  const [market, aiNews] = await Promise.all([
    readMarketResearchSeed().catch(() => null),
    readAiNewsSeed().catch(() => null),
  ])
  return { market, aiNews }
}

function marketObservationSources(observation?: MarketObservationSeed): string[] {
  if (!observation) return []
  return [
    observation.market ? 'market-research' : '',
    observation.aiNews ? 'ai-news' : '',
  ].filter(Boolean)
}

function buildMarketObservationBlock(observation?: MarketObservationSeed): string[] {
  if (!observation?.market && !observation?.aiNews) return []
  const lines = [
    '## 市場観測(今日の調査より)',
    'この市場観測に基づき、App Store / Google Play で公開・DL・収益化が狙えるモバイルアプリ案を作ってください。既存seedは補助情報として使ってください。',
  ]
  if (observation.market) {
    lines.push(`注目ジャンル (${observation.market.date}):`)
    lines.push(...(observation.market.genres.length > 0 ? observation.market.genres : ['該当セクションなし']).map((item) => `- ${item}`))
    lines.push(`収益化ヒント (${observation.market.date}):`)
    lines.push(...(observation.market.monetizationHints.length > 0 ? observation.market.monetizationHints : ['該当セクションなし']).map((item) => `- ${item}`))
  }
  if (observation.aiNews) {
    lines.push(`重要ニュース(高影響) (${observation.aiNews.date}):`)
    lines.push(...(observation.aiNews.highlights.length > 0 ? observation.aiNews.highlights : ['高影響ニュースなし']).map((item) => `- ${item}`))
  }
  return lines
}

function buildAiPrompt(seeds: ProposalSeed[], observation?: MarketObservationSeed): string {
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
    ...(observation?.market || observation?.aiNews
      ? ['市場観測を主たる種として扱い、注目ジャンル、収益化ヒント、個人開発への影響度が高いニュースからアプリ案の需要・課金価値・差別化を組み立ててください。']
      : []),
    '各案は単なる「支援アプリ」ではなく、ユーザーがストアで探してインストールする理由が明確なものにしてください。',
    ...buildMarketObservationBlock(observation),
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
      riskFlags: ['billing', 'external_publish'],
      spec: '詳細仕様。機能、画面遷移、データ、通知、オフライン、技術前提などの要約。',
      mvpScope: '最初のストア審査に出せるMVP範囲。画面、必須機能、後回し機能を1〜3文で書く。',
      difficulty: 'medium',
      externalApis: ['RevenueCat', 'Firebase', 'MapKit'],
      initialGoalDraft: 'Codexが最初に作るべきGoal案。初期画面、データモデル、最小保存/課金スタブなどを1〜3文で書く。',
      decisionPoints: [
        { key: 'platform', question: '最初に公開するストア対象は？', options: ['iOS', 'Android', 'iOS + Android', 'iPad対応'], required: true },
        { key: 'pricing', question: '最初の課金方式は？', options: ['買い切り', '月額サブスク', 'アプリ内課金', '広告 + 課金解除'], required: false },
        { key: 'mvp_scope', question: 'MVPの最小機能セットはどこまでにする？', options: ['記録と一覧だけ', '通知まで含める', '分析まで含める'], required: true },
        { key: 'data_storage', question: 'データ保存先は？', options: ['端末内のみ', 'クラウド同期あり', '端末内 + 手動バックアップ'], required: true },
        { key: 'auth', question: '認証を入れる？', options: ['認証なし', 'Apple/Googleログイン', 'メールログイン'], required: true },
        { key: 'offline', question: 'オフライン対応は必要？', options: ['必須', '一部対応', '不要'], required: false },
        { key: 'privacy', question: '収集する個人情報とプライバシー方針は？', options: ['個人情報なし', 'メールのみ', '利用ログを収集', '位置情報を収集'], required: true },
        { key: 'region_language', question: '公開時の対象地域・言語は？', options: ['日本語/日本', '英語/グローバル', '日英対応'], required: false },
      ],
    }], null, 2),
    '',
    '制約:',
    '- screens はモバイル画面を4〜5枚にする。',
    "- oceanType は 'blue' または 'red' のみ。",
    '- monetizationPlan は必ず App Store / Google Play の課金・広告モデルにする。',
    "- difficulty は 'low' / 'medium' / 'high' のみ。",
    '- externalApis は RevenueCat, Firebase, MapKit, CloudKit, Supabase など必要な外部サービス/API名を配列で入れる。無ければ空配列。',
    '- mvpScope は最初のストア審査に出せるMVP範囲を1〜3文で書く。',
    '- initialGoalDraft はCodexへ渡す「最初に何を作るか」の初期Goal案を1〜3文で書く。',
    '- riskFlags は該当する危険要素を配列で入れる。billing=課金 / auth_secret=認証情報 / external_publish=外部公開 / production_db=本番DB / destructive=破壊的 / migration=スキーマ変更。無ければ空配列。',
    '- decisionPoints の platform 選択肢に Web を入れない。',
    '- decisionPoints は上限8件。作る前に決めるべき方針を漏れなく列挙する。',
    '- decisionPoints は最低限、該当するカテゴリを適切に required 設定して含める: platform(必須), 課金方式, 最小機能セット, データ保存先(端末内 or クラウド), 認証の有無, オフライン対応の要否, 収集する個人情報とプライバシー方針, 公開時の対象地域・言語, 通知の有無。',
    '- 認証情報を扱う、課金する、外部公開する、個人情報を扱う判断は required:true 寄りにする。',
    '- decisionPoints の各項目は {key, question, options(2〜4), required} 形式。required は作る前に必ず人間の回答が要る判断だけ true。',
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
    const source = point as { key?: unknown; question?: unknown; options?: unknown; required?: unknown }
    const key = compactText(source.key, '', 40)
    const question = compactText(source.question, '', 120)
    if (!key || !question) continue
    const options = stringList(source.options, [], 4)
    points.push({ key, question, options: options.length >= 2 ? options : [], required: source.required === true })
    if (points.length >= 8) break
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
    riskFlags: normalizeRiskFlags(source.riskFlags),
    spec: compactText(source.spec, '詳細仕様は今日の判断で要精査。モバイル画面、通知、データ保存、ストア課金を前提に詰める。', 1200),
    mvpScope: typeof source.mvpScope === 'string' && source.mvpScope.trim() ? compactText(source.mvpScope, '', 500) : undefined,
    difficulty: normalizeDifficulty(source.difficulty),
    externalApis: stringList(source.externalApis, [], 8),
    initialGoalDraft: typeof source.initialGoalDraft === 'string' && source.initialGoalDraft.trim() ? compactText(source.initialGoalDraft, '', 600) : undefined,
    decisionPoints: decisionPoints.length > 0 ? decisionPoints : [
      { key: 'platform', question: '最初に公開するストア対象は？', options: ['iOS', 'Android', 'iOS + Android', 'iPad対応'], required: true },
      { key: 'pricing', question: '最初の課金方式は？', options: ['買い切り', '月額サブスク', 'アプリ内課金', '広告 + 課金解除'], required: false },
      { key: 'data_storage', question: 'データ保存先は？', options: ['端末内のみ', 'クラウド同期あり', '端末内 + 手動バックアップ'], required: true },
      { key: 'auth', question: '認証を入れる？', options: ['認証なし', 'Apple/Googleログイン', 'メールログイン'], required: true },
      { key: 'privacy', question: '収集する個人情報とプライバシー方針は？', options: ['個人情報なし', 'メールのみ', '利用ログを収集', '位置情報を収集'], required: true },
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
    riskFlags: proposal.riskFlags,
    spec: proposal.spec,
    mvpScope: proposal.mvpScope,
    difficulty: proposal.difficulty,
    externalApis: proposal.externalApis,
    initialGoalDraft: proposal.initialGoalDraft,
    priority: priorityForProposal(proposal),
    status: 'proposed',
    nextAction: 'ストア公開対象、課金方式、MVP機能、審査リスクを今日の判断で決める',
    factorySafe: false,
    factoryNote: 'App Store / Google Play 公開前提の自動生成案。方針決定とストア審査観点の確認後に Factory 対象化する。',
    decisionPoints: proposal.decisionPoints,
    createdAt: now,
  }
}

function fallbackProposal(seed: ProposalSeed, observation?: MarketObservationSeed): AiStoreAppProposal {
  const genre = observation?.market?.genres[0]
  const genreLabel = genre ? compactText(genre.replace(/^[・\-\s]+/, '').replace(/[。．.].*$/, '').replace(/[:：].*$/, ''), '', 32) : ''
  const baseTitle = seed.title.replace(/を(試す|調査する)$/, '').trim() || seed.title
  const title = `${genreLabel || baseTitle}モバイル`
  const summary = seed.summary.slice(0, 180)
  const marketNote = genre ? `今日の市場観測「${genre.slice(0, 140)}」も踏まえる。` : ''
  return {
    title,
    overview: `${genreLabel ? '市場観測' : seed.source} 起点のストア公開前提モバイルアプリ案。今日の判断で要精査。`,
    purpose: `${summary} をもとに、iOS / Android ユーザーが日常的に記録・判断・次アクション化できるストア公開アプリを作る。${marketNote}`,
    targetUser: 'App Store / Google Play で課題解決アプリを探す iOS / Android ユーザー',
    features: ['クイック記録', '一覧と検索', '判断メモ', 'リマインダー', '課金プラン管理'],
    screens: [
      { name: 'ホーム', rows: ['今日のサマリー', '未処理の記録', '次のおすすめ', 'プレミアム導線'] },
      { name: '記録', rows: ['入力フォーム', 'テンプレート選択', '保存前チェック', '通知設定'] },
      { name: '一覧', rows: ['履歴カード', '検索', 'タグ絞り込み', '重要度バッジ'] },
      { name: '詳細', rows: ['要約', '判断メモ', '次アクション', '共有'] },
      { name: '設定', rows: ['iOS / Android 通知', 'サブスク状態', 'データ管理', 'ストアレビュー導線'] },
    ],
    marketValue: `${genreLabel ? `注目ジャンル「${genreLabel}」` : `${seed.source} 由来`}の需要仮説。App Store / Google Play で類似カテゴリ、検索語、価格帯、レビュー不満、支払い意思を今日の判断で要精査。`,
    oceanType: 'unknown',
    oceanRationale: 'ストア競合密度、レビュー不満、差別化可能なワークフローは未調査。今日の判断で要精査。',
    monetizationHypothesis: '無料インストールで利用開始し、継続利用・通知・テンプレート・分析の価値に対してストア課金する仮説。',
    monetizationPlan: 'App Store / Google Play のアプリ内課金を前提に、無料枠 + 月額サブスクを第一候補、必要に応じて買い切り解除または広告 + 課金解除を検証する。',
    winningFactors: ['今日の判断で要精査', 'iOS / Android の日常利用導線に載せられる可能性', 'ストアレビュー不満から差別化余地を探せる'],
    concerns: ['今日の判断で要精査', 'ストア競合・審査リスク・継続率が未検証', '課金価値が弱い場合は広告依存になりやすい'],
    riskFlags: [],
    spec: '詳細仕様は今日の判断で要精査。iOS / Android 対応、ローカル保存 + 任意クラウド同期、プッシュ通知、App Store / Google Play のアプリ内課金、ストア審査に通るデータ・プライバシー表示を前提にMVPを定義する。',
    decisionPoints: [
      { key: 'platform', question: '最初に公開するストア対象は？', options: ['iOS', 'Android', 'iOS + Android', 'iPad対応'], required: true },
      { key: 'pricing', question: '最初の課金方式は？', options: ['無料 + 月額サブスク', '買い切り', 'アプリ内課金', '広告 + 課金解除'], required: false },
      { key: 'mvp', question: '最小機能セットはどこまでにする？', options: ['記録と一覧だけ', '通知まで含める', '分析まで含める'], required: false },
    ],
  }
}

export async function generateStoreAppProposalsViaAI(seeds: ProposalSeed[], observation?: MarketObservationSeed): Promise<{ proposals: AiStoreAppProposal[]; mode: 'ai' | 'fallback'; reason: string }> {
  const prompt = buildAiPrompt(seeds, observation)
  const ai = await runProposalCli(prompt)
  if (ai.source === 'ai' && ai.proposals.length > 0) {
    return { proposals: ai.proposals, mode: 'ai', reason: ai.reason }
  }
  return { proposals: [fallbackProposal(seeds[0], observation)], mode: 'fallback', reason: ai.reason }
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
  const observation = await collectMarketObservationSeed()
  const seedSources = [
    ...marketObservationSources(observation),
    ...Array.from(new Set(seeds.map((seed) => seed.source))),
  ]
  const now = new Date().toISOString()
  const generated = await generateStoreAppProposalsViaAI(seeds, observation)
  const candidates = generated.proposals.slice(0, MAX_AI_PROPOSALS).map((proposal, index) => toCandidate(proposal, index, now))

  const candidateIds: string[] = []
  for (const candidate of candidates.length > 0 ? candidates : [toCandidate(fallbackProposal(seeds[0], observation), 0, now)]) {
    await addAppFactoryCandidate(candidate)
    candidateIds.push(candidate.id)
  }

  await appendAutomationLog({
    event: 'app_proposal_generated',
    fallbackReason: `mode=${generated.mode} count=${candidateIds.length} seed=${seedSources.join(',') || 'none'} reason=${generated.reason}`,
    fallbackTarget: candidateIds.join(','),
  })

  return {
    generated: true,
    reason: `${generated.mode} generated (${generated.reason})`,
    candidateId: candidateIds[0],
    candidateIds,
  }
}
