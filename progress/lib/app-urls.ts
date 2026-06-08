import { readJson } from '@/lib/store'

export type AppUrlStatus = 'active' | 'unknown' | 'deploy_ready' | 'local_only' | 'archived'
export type AppUrlKind = 'vercel' | 'vps' | 'local_dev' | 'ssh_port_forward' | 'api' | 'unknown'
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
  local_dev: 3,
  ssh_port_forward: 4,
  unknown: 5,
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
