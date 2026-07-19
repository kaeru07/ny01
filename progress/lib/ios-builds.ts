import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import type {
  IosBuildsAppResponse,
  IosBuildsResponse,
  IosCandidate,
  IosCodemagicBuild,
  IosDiscoveredApp,
  IosLocalGit,
  IosTestflightBuild,
  IosTestflightState,
  IosUnshippedCommit,
  IosUnshippedCommits,
} from '@/types/ios-builds'

const APPS_ROOT = '/root/company/apps'
const SECRETS_DIR = '/root/.secrets/appstore'
const CODEMAGIC_ENV_PATH = path.join(SECRETS_DIR, 'codemagic.env')
const ASC_ENV_PATH = path.join(SECRETS_DIR, 'asc.env')
const DEFAULT_ASC_KEY_PATH = path.join(SECRETS_DIR, 'asc_key.p8')
const FETCH_TIMEOUT_MS = 10_000

interface CodemagicSecrets {
  ready: boolean
  token: string | null
  defaultAppId: string | null
  reason?: string
}

interface AscSecrets {
  ready: boolean
  issuerId: string | null
  keyId: string | null
  keyPath: string
  reason?: string
}

interface CodemagicAppState {
  dir: string
  codemagicAppId: string | null
  builds: IosCodemagicBuild[]
  error?: string
}

interface CodemagicState {
  ready: boolean
  error?: string
  apps: CodemagicAppState[]
}

export type TriggerBuildResult =
  | { success: true; buildId: string | null }
  | { success: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function numberOrStringValue(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return stringValue(value)
}

function getPathValue(record: Record<string, unknown>, keys: string[]): unknown {
  let current: unknown = record
  for (const key of keys) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = stringValue(value)
    if (text) return text
  }
  return null
}

function firstNumberOrString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = numberOrStringValue(value)
    if (text) return text
  }
  return null
}

function sanitizeError(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'request timed out'
  if (error instanceof Error && error.message.trim()) {
    return error.message
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
      .replace(/x-auth-token[:=]\s*[A-Za-z0-9._-]+/gi, 'x-auth-token=[redacted]')
      .slice(0, 200)
  }
  return 'unknown error'
}

function parseJsonRecord(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {}
  const env: Record<string, string> = {}
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[match[1]] = value
  }
  return env
}

export function loadCodemagicSecrets(): CodemagicSecrets {
  const env = loadEnvFile(CODEMAGIC_ENV_PATH)
  const token = stringValue(env.CODEMAGIC_API_TOKEN)
  return {
    ready: Boolean(token),
    token,
    defaultAppId: stringValue(env.CODEMAGIC_APP_ID),
    reason: token ? undefined : 'Codemagicトークン未配置',
  }
}

export function loadAscSecrets(): AscSecrets {
  const env = loadEnvFile(ASC_ENV_PATH)
  const keyPath = stringValue(env.ASC_KEY_PATH) ?? DEFAULT_ASC_KEY_PATH
  const issuerId = stringValue(env.ASC_ISSUER_ID)
  const keyId = stringValue(env.ASC_KEY_ID)
  const ready = Boolean(issuerId && keyId && fs.existsSync(keyPath))
  return {
    ready,
    issuerId,
    keyId,
    keyPath,
    reason: ready ? undefined : 'ASCキー未配置',
  }
}

function safeReadJsonRecord(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null
    return parseJsonRecord(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return null
  }
}

function safeExecGit(appDir: string, command: string): string | null {
  try {
    const value = execSync(command, {
      cwd: appDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return value || null
  } catch {
    return null
  }
}

function safeGitHash(hash: string | null | undefined): string | null {
  if (!hash) return null
  const trimmed = hash.trim()
  return /^[0-9a-fA-F]{7,40}$/.test(trimmed) ? trimmed : null
}

function readLocalGit(appDir: string): IosLocalGit {
  return {
    head: safeExecGit(appDir, 'git rev-parse --short HEAD'),
    lastCommitAt: safeExecGit(appDir, 'git log -1 --format=%cI'),
    subject: safeExecGit(appDir, 'git log -1 --format=%s'),
    originUrl: safeExecGit(appDir, 'git remote get-url origin'),
  }
}

function readBuiltCommitSubject(appDir: string, hash: string): string | null {
  return safeExecGit(appDir, `git show -s --format=%s ${hash}`)
}

function normalizeRepository(input: string | null | undefined): string | null {
  if (!input) return null
  let value = input.trim()
  value = value.replace(/^git@github\.com:/, '')
  value = value.replace(/^https?:\/\/github\.com\//, '')
  value = value.replace(/^ssh:\/\/git@github\.com\//, '')
  value = value.replace(/\.git$/, '')
  value = value.replace(/\/$/, '')
  const parts = value.split('/').filter(Boolean)
  if (parts.length < 2) return null
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`.toLowerCase()
}

function readCapacitorConfig(appDir: string): { appId: string | null; appName: string | null } {
  const jsonPath = path.join(appDir, 'capacitor.config.json')
  const tsPath = path.join(appDir, 'capacitor.config.ts')
  const jsPath = path.join(appDir, 'capacitor.config.js')
  const jsonConfig = safeReadJsonRecord(jsonPath)
  if (jsonConfig) {
    return {
      appId: stringValue(jsonConfig.appId),
      appName: stringValue(jsonConfig.appName),
    }
  }

  for (const filePath of [tsPath, jsPath]) {
    try {
      if (!fs.existsSync(filePath)) continue
      const source = fs.readFileSync(filePath, 'utf8')
      return {
        appId: source.match(/appId\s*:\s*["']([^"']+)["']/)?.[1] ?? null,
        appName: source.match(/appName\s*:\s*["']([^"']+)["']/)?.[1] ?? null,
      }
    } catch {
      return { appId: null, appName: null }
    }
  }
  return { appId: null, appName: null }
}

function readPackageName(appDir: string): string | null {
  const pkg = safeReadJsonRecord(path.join(appDir, 'package.json'))
  return stringValue(pkg?.name)
}

function firstWorkflowId(yaml: string): string | null {
  let inWorkflows = false
  for (const line of yaml.split('\n')) {
    if (/^workflows:\s*$/.test(line)) {
      inWorkflows = true
      continue
    }
    if (!inWorkflows) continue
    if (/^\S/.test(line)) return null
    const match = line.match(/^  ([A-Za-z0-9_-]+):\s*$/)
    if (match) return match[1]
  }
  return null
}

function yamlVar(yaml: string, key: string): string | null {
  const match = yaml.match(new RegExp(`^\\s*${key}:\\s*['"]?([^'"\\n#]+)['"]?`, 'm'))
  return match?.[1]?.trim() ?? null
}

export function discoverIosApps(): IosDiscoveredApp[] {
  const entries = fs.readdirSync(APPS_ROOT, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ dir: entry.name, appDir: path.join(APPS_ROOT, entry.name) }))
    .filter((entry) => fs.existsSync(path.join(entry.appDir, 'codemagic.yaml')))
    .sort((a, b) => a.dir.localeCompare(b.dir))
    .map(({ dir, appDir }) => {
      const release = safeReadJsonRecord(path.join(appDir, 'release', 'ios-app.json'))
      const yaml = fs.readFileSync(path.join(appDir, 'codemagic.yaml'), 'utf8')
      const capacitor = readCapacitorConfig(appDir)
      const localGit = readLocalGit(appDir)
      const originRepository = normalizeRepository(localGit.originUrl)
      const branch = firstString(release?.branch, safeExecGit(appDir, 'git rev-parse --abbrev-ref HEAD'))

      return {
        dir,
        appDir,
        appName: firstString(release?.appName, capacitor.appName, readPackageName(appDir), dir) ?? dir,
        bundleId: firstString(release?.bundleId, capacitor.appId, yamlVar(yaml, 'BUNDLE_ID')),
        repository: firstString(release?.repository, originRepository),
        branch,
        workflowId: firstString(release?.codemagicWorkflowId, firstWorkflowId(yaml)),
        version: firstString(release?.version, yamlVar(yaml, 'APP_VERSION')),
        buildNumber: firstNumberOrString(release?.buildNumber, yamlVar(yaml, 'BUILD_NUMBER')),
        localGit,
      }
    })
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json().catch(() => null)
  } finally {
    clearTimeout(timeout)
  }
}

function recordArray(value: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (!isRecord(value)) return []
  for (const key of keys) {
    const child = value[key]
    if (Array.isArray(child)) return child.filter(isRecord)
  }
  return []
}

function parseCodemagicAppId(app: Record<string, unknown>): string | null {
  return firstString(app._id, app.id, app.appId)
}

function parseCodemagicRepository(app: Record<string, unknown>): string | null {
  return normalizeRepository(firstString(
    getPathValue(app, ['repository', 'htmlUrl']),
    getPathValue(app, ['repository', 'url']),
    getPathValue(app, ['repository', 'sshUrl']),
    getPathValue(app, ['repository', 'name']),
    app.repository,
  ))
}

function appLooksLikeDefaultHima(app: IosDiscoveredApp): boolean {
  return app.dir === 'hima-app' || app.repository === 'kaeru07/hima-tsubushi-app'
}

function resolveCodemagicAppId(app: IosDiscoveredApp, cmApps: Record<string, unknown>[], defaultAppId: string | null): string | null {
  const repo = normalizeRepository(app.repository)
  const matched = repo
    ? cmApps.find((cmApp) => parseCodemagicRepository(cmApp) === repo)
    : undefined
  return matched ? parseCodemagicAppId(matched) : appLooksLikeDefaultHima(app) ? defaultAppId : null
}

function parseCodemagicBuild(build: Record<string, unknown>): IosCodemagicBuild {
  return {
    buildId: firstString(build._id, build.id, build.buildId),
    status: firstString(build.status, build.buildStatus),
    workflowId: firstString(
      build.workflowId,
      getPathValue(build, ['workflow', 'id']),
      getPathValue(build, ['workflow', 'workflowId']),
      getPathValue(build, ['workflow', 'name']),
    ),
    branch: firstString(build.branch, build.branchName, getPathValue(build, ['commit', 'branch'])),
    startedAt: firstString(build.startedAt, build.started_at, build.createdAt, build.queuedAt),
    finishedAt: firstString(build.finishedAt, build.finished_at, build.completedAt),
    commitHash: firstString(
      getPathValue(build, ['commit', 'hash']),
      getPathValue(build, ['commit', 'sha']),
      getPathValue(build, ['commit', 'id']),
      getPathValue(build, ['commit', 'commitHash']),
      build.commitHash,
      build.commitSha,
      build.sha,
    ),
  }
}

async function fetchCodemagicApps(token: string): Promise<{ apps: Record<string, unknown>[] } | { error: string }> {
  try {
    const json = await fetchJson('https://api.codemagic.io/apps', {
      method: 'GET',
      headers: { 'x-auth-token': token },
    })
    return { apps: recordArray(json, ['applications', 'apps', 'data']) }
  } catch (error) {
    return { error: `Codemagic API接続失敗: ${sanitizeError(error)}` }
  }
}

async function fetchCodemagicBuilds(token: string, appId: string): Promise<{ builds: IosCodemagicBuild[] } | { error: string }> {
  try {
    const url = `https://api.codemagic.io/builds?appId=${encodeURIComponent(appId)}`
    const json = await fetchJson(url, {
      method: 'GET',
      headers: { 'x-auth-token': token },
    })
    const builds = recordArray(json, ['builds', 'data'])
      .map(parseCodemagicBuild)
      .slice(0, 5)
    return { builds }
  } catch (error) {
    return { error: `Codemagicビルド取得失敗: ${sanitizeError(error)}` }
  }
}

export async function fetchCodemagicState(apps = discoverIosApps()): Promise<CodemagicState> {
  const secrets = loadCodemagicSecrets()
  const empty = apps.map((app) => ({
    dir: app.dir,
    codemagicAppId: appLooksLikeDefaultHima(app) ? secrets.defaultAppId : null,
    builds: [],
    error: secrets.reason,
  }))
  if (!secrets.ready || !secrets.token) {
    return { ready: false, error: secrets.reason, apps: empty }
  }
  const token = secrets.token

  const appResult = await fetchCodemagicApps(token)
  if ('error' in appResult) {
    return {
      ready: true,
      error: appResult.error,
      apps: apps.map((app) => ({
        dir: app.dir,
        codemagicAppId: appLooksLikeDefaultHima(app) ? secrets.defaultAppId : null,
        builds: [],
        error: appResult.error,
      })),
    }
  }

  const states = await Promise.all(apps.map(async (app) => {
    const appId = resolveCodemagicAppId(app, appResult.apps, secrets.defaultAppId)
    if (!appId) {
      return {
        dir: app.dir,
        codemagicAppId: null,
        builds: [],
        error: 'Codemagic appId未解決',
      }
    }
    const buildsResult = await fetchCodemagicBuilds(token, appId)
    if ('error' in buildsResult) {
      return { dir: app.dir, codemagicAppId: appId, builds: [], error: buildsResult.error }
    }
    return { dir: app.dir, codemagicAppId: appId, builds: buildsResult.builds }
  }))

  return { ready: true, apps: states }
}

function ascJwt(secrets: AscSecrets): string {
  if (!secrets.issuerId || !secrets.keyId) throw new Error('ASCキー未配置')
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: secrets.keyId, typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: secrets.issuerId,
    iat: Math.floor(Date.now() / 1000) - 30,
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
    aud: 'appstoreconnect-v1',
  })).toString('base64url')
  const key = crypto.createPrivateKey(fs.readFileSync(secrets.keyPath, 'utf8'))
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${signature.toString('base64url')}`
}

async function ascGet(secrets: AscSecrets, endpoint: string): Promise<unknown> {
  return fetchJson(`https://api.appstoreconnect.apple.com${endpoint}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ascJwt(secrets)}`,
      'Content-Type': 'application/json',
    },
  })
}

function parseTestflightBuild(build: Record<string, unknown>): IosTestflightBuild {
  const attributes = isRecord(build.attributes) ? build.attributes : {}
  return {
    version: firstString(attributes.version, attributes.buildVersion, build.version),
    processingState: firstString(attributes.processingState, build.processingState),
    uploadedDate: firstString(attributes.uploadedDate, build.uploadedDate),
  }
}

export async function fetchTestflight(bundleId: string | null): Promise<IosTestflightState> {
  const secrets = loadAscSecrets()
  if (!secrets.ready) return { available: false, reason: secrets.reason ?? 'ASCキー未配置' }
  if (!bundleId) return { available: false, reason: 'bundleId未設定' }

  try {
    const appParams = new URLSearchParams({ 'filter[bundleId]': bundleId })
    const appsJson = await ascGet(secrets, `/v1/apps?${appParams.toString()}`)
    const ascApp = recordArray(appsJson, ['data'])[0]
    const ascAppId = ascApp ? stringValue(ascApp.id) : null
    if (!ascAppId) return { available: true, builds: [] }

    const buildParams = new URLSearchParams({
      'filter[app]': ascAppId,
      sort: '-uploadedDate',
      limit: '3',
    })
    const buildsJson = await ascGet(secrets, `/v1/builds?${buildParams.toString()}`)
    return {
      available: true,
      builds: recordArray(buildsJson, ['data']).map(parseTestflightBuild),
    }
  } catch (error) {
    return {
      available: true,
      builds: [],
      error: `TestFlight取得失敗: ${sanitizeError(error)}`,
    }
  }
}

function statusKey(status: string | null): string {
  return (status ?? '').toLowerCase()
}

function buildTimeMs(build: IosCodemagicBuild): number {
  const time = build.startedAt ?? build.finishedAt
  return time ? Date.parse(time) || 0 : 0
}

function sortedBuilds(builds: IosCodemagicBuild[]): IosCodemagicBuild[] {
  return [...builds].sort((a, b) => buildTimeMs(b) - buildTimeMs(a))
}

function latestSuccessfulBuild(builds: IosCodemagicBuild[]): IosCodemagicBuild | null {
  return sortedBuilds(builds).find((build) => isSuccessStatus(build.status)) ?? null
}

function isFailedStatus(status: string | null): boolean {
  return ['failed', 'canceled', 'cancelled', 'timeout', 'timed_out'].includes(statusKey(status))
}

function isSuccessStatus(status: string | null): boolean {
  return ['finished', 'success', 'successful', 'passed'].includes(statusKey(status))
}

function hashesMatch(local: string, remote: string): boolean {
  const a = local.toLowerCase()
  const b = remote.toLowerCase()
  return a === b || a.startsWith(b) || b.startsWith(a)
}

export function formatJstShortDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`
}

export function formatUnshippedCommitLines(summary: IosUnshippedCommits | null): string[] {
  if (!summary || summary.total <= 0) return []
  const lines = summary.commits.map((commit) => {
    const time = formatJstShortDateTime(commit.committedAt)
    return time ? `- 『${commit.subject}』（${time}）` : `- 『${commit.subject}』`
  })
  const remaining = summary.total - summary.commits.length
  if (remaining > 0) lines.push(`- ほか${remaining}件`)
  return lines
}

export function readUnshippedCommits(appDir: string, latestSuccessBuild: IosCodemagicBuild | null): IosUnshippedCommits | null {
  const builtHash = safeGitHash(latestSuccessBuild?.commitHash)
  if (!builtHash) return null

  const output = safeExecGit(appDir, `git log --format=%s§%cI ${builtHash}..HEAD`)
  if (output === null) return null

  const commits: IosUnshippedCommit[] = output
    ? output.split('\n').filter(Boolean).map((line) => {
        const separator = line.lastIndexOf('§')
        if (separator === -1) return { subject: line.trim(), committedAt: null }
        return {
          subject: line.slice(0, separator).trim(),
          committedAt: line.slice(separator + 1).trim() || null,
        }
      }).filter((commit) => commit.subject)
    : []

  return {
    total: commits.length,
    commits: commits.slice(0, 5),
    baseFinishedAt: latestSuccessBuild?.finishedAt ?? null,
    baseSubject: readBuiltCommitSubject(appDir, builtHash),
  }
}

export function deriveCandidate(
  app: Pick<IosDiscoveredApp, 'localGit'>,
  builds: IosCodemagicBuild[],
  localGit: IosLocalGit = app.localGit,
): IosCandidate {
  const orderedBuilds = sortedBuilds(builds)
  if (orderedBuilds.length === 0) {
    return { isCandidate: true, reason: '未ビルド' }
  }

  const latestBuild = orderedBuilds[0]
  if (isFailedStatus(latestBuild.status)) {
    return { isCandidate: true, reason: '最新ビルド失敗' }
  }

  const latestSuccessBuild = latestSuccessfulBuild(orderedBuilds)
  if (!latestSuccessBuild) {
    return { isCandidate: false }
  }

  if (localGit.head && latestSuccessBuild.commitHash) {
    if (!hashesMatch(localGit.head, latestSuccessBuild.commitHash)) {
      return { isCandidate: true, reason: '未反映コミットあり' }
    }
    return { isCandidate: false }
  }

  if (localGit.lastCommitAt && latestSuccessBuild.finishedAt) {
    const localTime = Date.parse(localGit.lastCommitAt)
    const buildTime = Date.parse(latestSuccessBuild.finishedAt)
    if (Number.isFinite(localTime) && Number.isFinite(buildTime) && localTime > buildTime) {
      return { isCandidate: true, reason: '未反映コミットあり' }
    }
  }

  return { isCandidate: false }
}

export async function triggerBuild(appDirName: string): Promise<TriggerBuildResult> {
  const app = discoverIosApps().find((item) => item.dir === appDirName)
  if (!app) return { success: false, error: '対象アプリが見つかりません' }

  const secrets = loadCodemagicSecrets()
  if (!secrets.ready || !secrets.token) {
    return { success: false, error: secrets.reason ?? 'Codemagicトークン未配置' }
  }

  const appResult = await fetchCodemagicApps(secrets.token)
  if ('error' in appResult) return { success: false, error: appResult.error }

  const appId = resolveCodemagicAppId(app, appResult.apps, secrets.defaultAppId)
  if (!appId) return { success: false, error: 'Codemagic appId未解決' }
  if (!app.workflowId) return { success: false, error: 'workflowId未設定' }
  if (!app.branch) return { success: false, error: 'branch未設定' }

  try {
    const json = await fetchJson('https://api.codemagic.io/builds', {
      method: 'POST',
      headers: {
        'x-auth-token': secrets.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appId,
        workflowId: app.workflowId,
        branch: app.branch,
      }),
    })
    const record = isRecord(json) ? json : {}
    const build = isRecord(record.build) ? record.build : record
    return {
      success: true,
      buildId: firstString(build._id, build.id, build.buildId, record.buildId),
    }
  } catch (error) {
    return { success: false, error: `Codemagicビルド起動失敗: ${sanitizeError(error)}` }
  }
}

export async function getIosBuildsOverview(): Promise<IosBuildsResponse> {
  const apps = discoverIosApps()
  const [codemagicState, testflightStates] = await Promise.all([
    fetchCodemagicState(apps),
    Promise.all(apps.map((app) => fetchTestflight(app.bundleId))),
  ])
  const cmByDir = new Map(codemagicState.apps.map((state) => [state.dir, state]))

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    codemagicReady: codemagicState.ready,
    ascReady: loadAscSecrets().ready,
    codemagicError: codemagicState.error,
    apps: apps.map((app, index): IosBuildsAppResponse => {
      const cm = cmByDir.get(app.dir)
      const builds = cm?.builds ?? []
      const candidate = cm?.error
        ? { isCandidate: false, reason: cm.error }
        : deriveCandidate(app, builds, app.localGit)
      const latestSuccess = latestSuccessfulBuild(builds)
      return {
        dir: app.dir,
        appName: app.appName,
        bundleId: app.bundleId,
        repository: app.repository,
        branch: app.branch,
        workflowId: app.workflowId,
        localGit: {
          head: app.localGit.head,
          lastCommitAt: app.localGit.lastCommitAt,
          subject: app.localGit.subject,
        },
        codemagicAppId: cm?.codemagicAppId ?? null,
        builds,
        unshippedCommits: candidate.reason === '未反映コミットあり'
          ? readUnshippedCommits(app.appDir, latestSuccess)
          : null,
        testflight: testflightStates[index],
        candidate,
        codemagicError: cm?.error,
      }
    }),
  }
}
