import { readJson, writeJson } from '@/lib/store'
import { normalizeUrlString } from '@/lib/url-normalize'

export type AppUrlStatus = 'active' | 'unknown' | 'deploy_ready' | 'local_only' | 'archived'
export type AppUrlKind = 'vercel' | 'vps' | 'vps_internal' | 'local_dev' | 'ssh_port_forward' | 'api' | 'unknown'
export type AppUrlConfidence = 'confirmed' | 'documented' | 'unknown'

export interface AppUrlRecord {
  kind: AppUrlKind
  label: string
  url: string
  confidence: AppUrlConfidence
  evidence: string
  evidenceDetail: string
  lastCheckedAt: string
}

export interface AppUrlEntry {
  id: string
  name: string
  purpose: string
  repoPath: string
  status: AppUrlStatus
  lastCheckedAt: string
  urls: AppUrlRecord[]
  notes?: string
}

export interface AppUrlRegistry {
  updatedAt: string
  operationMemo: string
  apps: AppUrlEntry[]
}

export async function readAppUrls(): Promise<AppUrlRegistry> {
  return readJson<AppUrlRegistry>('app-urls.json', {
    updatedAt: '',
    operationMemo: '',
    apps: [],
  })
}

export async function writeAppUrls(registry: AppUrlRegistry): Promise<void> {
  await writeJson<AppUrlRegistry>('app-urls.json', registry)
}

// ─────────────────────────────────────────────────────────────
// ユーザー入力で URL を編集するための正規化
//
// 画面から手入力された URL レコードを安全な AppUrlRecord に整える。
// 既存レコードを編集した場合は evidence 等のメタを維持し、新規行や空メタは
// 「ユーザー入力」の既定値で埋める。kind / confidence は許可値のみ受け付ける。
// ─────────────────────────────────────────────────────────────

const VALID_KINDS: AppUrlKind[] = [
  'vercel', 'vps', 'vps_internal', 'local_dev', 'ssh_port_forward', 'api', 'unknown',
]
const VALID_CONFIDENCE: AppUrlConfidence[] = ['confirmed', 'documented', 'unknown']

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 1 件の入力 URL を正規化する。不正な kind / confidence は安全側へフォールバック。 */
export function normalizeUrlInput(input: Partial<AppUrlRecord>): AppUrlRecord {
  const url = normalizeUrlString(input.url ?? '')
  const kind: AppUrlKind = VALID_KINDS.includes(input.kind as AppUrlKind)
    ? (input.kind as AppUrlKind)
    : 'unknown'
  const confidence: AppUrlConfidence = VALID_CONFIDENCE.includes(input.confidence as AppUrlConfidence)
    ? (input.confidence as AppUrlConfidence)
    : 'documented'
  return {
    kind,
    label: (input.label ?? '').trim(),
    url: url || '未確認',
    confidence,
    evidence: (input.evidence ?? '').trim() || 'ユーザー入力',
    evidenceDetail: (input.evidenceDetail ?? '').trim() || '画面から手入力',
    lastCheckedAt: (input.lastCheckedAt ?? '').trim() || todayStr(),
  }
}

/**
 * 指定アプリの URL 群（および任意のアプリ属性）をユーザー入力で置き換える。
 * 見つからなければ null を返す。成功時は更新後の registry を返す。
 */
export function applyAppUrlEdit(
  registry: AppUrlRegistry,
  appId: string,
  patch: { urls?: Partial<AppUrlRecord>[]; name?: string; purpose?: string; status?: AppUrlStatus; notes?: string },
): AppUrlRegistry | null {
  const idx = registry.apps.findIndex((a) => a.id === appId)
  if (idx === -1) return null
  const app = registry.apps[idx]
  const next: AppUrlEntry = { ...app }

  if (Array.isArray(patch.urls)) {
    next.urls = patch.urls
      // url も label も空の行は破棄
      .filter((u) => ((u.url ?? '').trim() || (u.label ?? '').trim()))
      .map(normalizeUrlInput)
  }
  if (typeof patch.name === 'string') next.name = patch.name.trim() || app.name
  if (typeof patch.purpose === 'string') next.purpose = patch.purpose
  if (typeof patch.notes === 'string') next.notes = patch.notes
  if (patch.status && (['active', 'unknown', 'deploy_ready', 'local_only', 'archived'] as AppUrlStatus[]).includes(patch.status)) {
    next.status = patch.status
  }
  next.lastCheckedAt = todayStr()

  const apps = [...registry.apps]
  apps[idx] = next
  return { ...registry, apps, updatedAt: new Date().toISOString() }
}

// ─────────────────────────────────────────────────────────────
// iPhone 到達性の分類
//
// この URL 台帳は「iPhone Safari / iPhone アプリから動作確認するための一覧」。
// VPS / 開発環境の内側からしか開けない URL（localhost / 127.0.0.1 / 内部ポート /
// SSH ポートフォワード前提）は iPhone から直接押せないため、メインの確認 URL に
// してはいけない。URL 文字列とその kind から到達性を機械的に分類する。推測で
// URL を作らない（'未確認' は unknown のまま）。
// ─────────────────────────────────────────────────────────────

export type IphoneAccess = 'ok' | 'blocked' | 'unknown'

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

// localhost / ループバック / プライベート IP（VPS 内部からしか届かない）かどうか
function isInternalHost(host: string): boolean {
  if (BLOCKED_HOSTS.has(host)) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true
  return false
}

// 1 つの URL レコードが iPhone から直接開けるか判定する
export function classifyRecordAccess(record: AppUrlRecord): IphoneAccess {
  if (!record.url || record.url === '未確認') return 'unknown'
  // SSH ポートフォワード前提の URL は iPhone から直接不可
  if (record.kind === 'ssh_port_forward') return 'blocked'
  const host = extractHost(record.url)
  if (!host) return 'unknown'
  if (isInternalHost(host)) return 'blocked'
  return 'ok'
}

// iPhone 確認 URL の優先順位（公開 URL の中での選好）
const PUBLIC_KIND_PRIORITY: Record<AppUrlKind, number> = {
  vercel: 0,
  vps: 1,
  api: 2,
  vps_internal: 3,
  local_dev: 4,
  ssh_port_forward: 5,
  unknown: 6,
}

export interface EnrichedAppUrl extends AppUrlEntry {
  // アプリ単位の iPhone 確認可否（公開 URL があれば ok、内部のみなら blocked、不明なら unknown）
  iphoneAccess: IphoneAccess
  // iPhone から押して確認できる代表 URL（公開 URL のみ。なければ null）
  iphonePrimary: AppUrlRecord | null
  // iPhone から開ける URL 群（vercel / 公開 VPS / HTTPS 公開）
  publicUrls: AppUrlRecord[]
  // iPhone から直接開けない URL 群（localhost / 内部ポート / SSH 前提）
  blockedUrls: AppUrlRecord[]
  // URL 不明な枠
  unknownUrls: AppUrlRecord[]
  // 「要Vercel化」「要公開URL確認」などの次アクション。ok のときは null
  actionHint: string | null
}

export function enrichApp(app: AppUrlEntry): EnrichedAppUrl {
  const withAccess = app.urls.map((url) => ({ url, access: classifyRecordAccess(url) }))
  const publicUrls = withAccess.filter((x) => x.access === 'ok').map((x) => x.url)
  const blockedUrls = withAccess.filter((x) => x.access === 'blocked').map((x) => x.url)
  const unknownUrls = withAccess.filter((x) => x.access === 'unknown').map((x) => x.url)

  const sortedPublic = [...publicUrls].sort(
    (a, b) => PUBLIC_KIND_PRIORITY[a.kind] - PUBLIC_KIND_PRIORITY[b.kind],
  )
  const iphonePrimary = sortedPublic[0] ?? null

  let iphoneAccess: IphoneAccess
  if (iphonePrimary) iphoneAccess = 'ok'
  else if (blockedUrls.length > 0) iphoneAccess = 'blocked'
  else iphoneAccess = 'unknown'

  let actionHint: string | null = null
  if (iphoneAccess !== 'ok') {
    // localhost / 内部ポートはあるが公開 URL が無い → Vercel 化 or 公開 URL 確認が必要
    actionHint = blockedUrls.length > 0 ? '要Vercel化 / 要公開URL確認' : '要公開URL確認'
  }

  return { ...app, iphoneAccess, iphonePrimary, publicUrls, blockedUrls, unknownUrls, actionHint }
}

export function enrichAppUrls(registry: AppUrlRegistry): EnrichedAppUrl[] {
  return registry.apps.map(enrichApp)
}
