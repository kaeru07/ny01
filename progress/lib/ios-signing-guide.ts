import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const APPS_ROOT = '/root/company/apps'
const PUBLIC_APP_URLS_PATH = path.join(APPS_ROOT, 'kaeru07.github.io', 'apps.json')

interface PublicAppUrls {
  bundleId: string
  privacyPolicyUrl: string
  supportUrl: string
}

export interface IosSigningGuideApp {
  id: string
  rootDir: string
  appDir: string
  appPathLabel: string
  appName: string
  bundleId: string
  sku: string
  workflowId: string
  workflowName: string | null
  workingDirectory: string | null
  repository: string | null
  branch: string | null
  appStoreConnectIntegration: string | null
  certificateReference: string | null
  provisioningProfileReference: string | null
  provisioningProfileName: string
  codemagicYamlPath: string
  privacyPolicyUrl: string | null
  supportUrl: string | null
  copyText: string
}

interface WorkflowBlock {
  id: string
  block: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function safeExecGit(cwd: string, command: string): string | null {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null
  } catch {
    return null
  }
}

function normalizeRepository(input: string | null): string | null {
  if (!input) return null
  let value = input.trim()
  value = value.replace(/^git@github\.com:/, '')
  value = value.replace(/^https?:\/\/github\.com\//, '')
  value = value.replace(/^ssh:\/\/git@github\.com\//, '')
  value = value.replace(/\.git$/, '')
  value = value.replace(/\/$/, '')
  const parts = value.split('/').filter(Boolean)
  if (parts.length < 2) return null
  return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function readPublicAppUrls(): Map<string, PublicAppUrls> {
  try {
    const parsed = JSON.parse(fs.readFileSync(PUBLIC_APP_URLS_PATH, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return new Map()
    return new Map(parsed.flatMap((item) => {
      if (!isRecord(item)) return []
      const bundleId = stringValue(item.bundleId)
      const privacyPolicyUrl = stringValue(item.privacyPolicyUrl)
      const supportUrl = stringValue(item.supportUrl)
      return bundleId && privacyPolicyUrl && supportUrl
        ? [[bundleId, { bundleId, privacyPolicyUrl, supportUrl }] as const]
        : []
    }))
  } catch {
    return new Map()
  }
}

function readCapacitorConfig(appDir: string): { appId: string | null; appName: string | null } {
  const json = safeReadJson(path.join(appDir, 'capacitor.config.json'))
  if (json) {
    return {
      appId: stringValue(json.appId),
      appName: stringValue(json.appName),
    }
  }

  for (const name of ['capacitor.config.ts', 'capacitor.config.js']) {
    try {
      const filePath = path.join(appDir, name)
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
  const pkg = safeReadJson(path.join(appDir, 'package.json'))
  return stringValue(pkg?.name)
}

function yamlScalar(block: string, key: string): string | null {
  const match = block.match(new RegExp(`^\\s*${key}:\\s*['"]?([^'"\\n#]+)['"]?`, 'm'))
  return match?.[1]?.trim() ?? null
}

function cleanYamlValue(value: string): string {
  return value
    .replace(/\s+#.*$/, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

function yamlListRefs(block: string, key: string): string[] {
  const lines = block.split('\n')
  const start = lines.findIndex((line) => new RegExp(`^\\s*${key}:\\s*$`).test(line))
  if (start === -1) return []
  const baseIndent = lines[start].match(/^(\s*)/)?.[1].length ?? 0
  const refs: string[] = []

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim()) continue
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0
    if (indent <= baseIndent) break
    const item = line.match(/^\s*-\s*(?:(?:profile|certificate):\s*)?(.+?)\s*$/)
    if (item) refs.push(cleanYamlValue(item[1]))
  }

  return refs.filter(Boolean)
}

function workflowBlocks(yaml: string): WorkflowBlock[] {
  const lines = yaml.split('\n')
  const workflowsIndex = lines.findIndex((line) => /^workflows:\s*$/.test(line))
  if (workflowsIndex === -1) return []

  const blocks: WorkflowBlock[] = []
  let current: { id: string; start: number } | null = null

  for (let i = workflowsIndex + 1; i < lines.length; i += 1) {
    const topLevel = /^\S/.test(lines[i])
    if (topLevel) break
    const match = lines[i].match(/^  ([A-Za-z0-9_-]+):\s*$/)
    if (!match) continue
    if (current) {
      blocks.push({ id: current.id, block: lines.slice(current.start, i).join('\n') })
    }
    current = { id: match[1], start: i }
  }

  if (current) blocks.push({ id: current.id, block: lines.slice(current.start).join('\n') })
  return blocks
}

function isTestflightWorkflow(block: string): boolean {
  return /^\s*submit_to_testflight:\s*true\s*$/m.test(block)
}

function skuFromBundleId(bundleId: string): string {
  const suffix = bundleId.split('.').filter(Boolean).slice(-1)[0] ?? 'ios-app'
  return `${suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-ios-001`
}

function buildCopyText(app: Omit<IosSigningGuideApp, 'copyText'>): string {
  return [
    `対象アプリ: ${app.appName}`,
    `作業場所: ${app.appPathLabel}`,
    '',
    'Apple Developer > Identifiers > App ID',
    `Description: ${app.appName}`,
    'Bundle ID Type: Explicit',
    `Bundle ID: ${app.bundleId}`,
    '',
    'App Store Connect > Apps > New App',
    'Platforms: iOS',
    `Name: ${app.appName}`,
    'Primary Language: Japanese',
    `Bundle ID: ${app.bundleId}`,
    `SKU: ${app.sku}`,
    'User Access: Full Access',
    `Privacy Policy URL: ${app.privacyPolicyUrl ?? '未作成'}`,
    `Support URL: ${app.supportUrl ?? '未作成'}`,
    '',
    'Apple Developer > Profiles > Distribution > App Store',
    `App ID: ${app.bundleId}`,
    `Certificate: ${app.certificateReference ?? 'IOS_DISTRIBUTION_CERTIFICATE'}`,
    `Profile Name: ${app.provisioningProfileName}`,
    '',
    'Codemagic > Team settings > codemagic.yaml settings > Code signing identities > iOS provisioning profiles',
    `Reference name: ${app.provisioningProfileReference ?? '未設定'}`,
    '',
    'Codemagic build',
    `App: ${app.rootDir}`,
    `Workflow: ${app.workflowId}`,
    `Branch: ${app.branch ?? 'main'}`,
  ].join('\n')
}

export function getIosSigningGuideApps(): IosSigningGuideApp[] {
  const entries = fs.readdirSync(APPS_ROOT, { withFileTypes: true })
  const apps: IosSigningGuideApp[] = []
  const publicUrls = readPublicAppUrls()

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const rootDir = path.join(APPS_ROOT, entry.name)
    const yamlPath = path.join(rootDir, 'codemagic.yaml')
    if (!fs.existsSync(yamlPath)) continue

    const yaml = fs.readFileSync(yamlPath, 'utf8')
    for (const workflow of workflowBlocks(yaml)) {
      if (!isTestflightWorkflow(workflow.block)) continue

      const workingDirectory = yamlScalar(workflow.block, 'working_directory')
      const appDir = workingDirectory ? path.join(rootDir, workingDirectory) : rootDir
      const appPathLabel = workingDirectory ? `${entry.name}/${workingDirectory}` : entry.name
      const capacitor = readCapacitorConfig(appDir)
      const bundleId = yamlScalar(workflow.block, 'BUNDLE_ID') ?? capacitor.appId
      if (!bundleId) continue

      const profileReference = yamlListRefs(workflow.block, 'provisioning_profiles')[0] ?? null
      const certificateReference = yamlListRefs(workflow.block, 'certificates')[0] ?? null
      const appName = capacitor.appName
        ?? yamlScalar(workflow.block, 'name')
        ?? readPackageName(appDir)
        ?? appPathLabel
      const urls = publicUrls.get(bundleId)
      const app: Omit<IosSigningGuideApp, 'copyText'> = {
        id: `${entry.name}:${workflow.id}`,
        rootDir: entry.name,
        appDir,
        appPathLabel,
        appName,
        bundleId,
        sku: skuFromBundleId(bundleId),
        workflowId: workflow.id,
        workflowName: yamlScalar(workflow.block, 'name'),
        workingDirectory,
        repository: normalizeRepository(safeExecGit(rootDir, 'git remote get-url origin')),
        branch: safeExecGit(rootDir, 'git rev-parse --abbrev-ref HEAD'),
        appStoreConnectIntegration: yamlScalar(workflow.block, 'app_store_connect'),
        certificateReference,
        provisioningProfileReference: profileReference,
        provisioningProfileName: `${appName} App Store Profile`,
        codemagicYamlPath: yamlPath,
        privacyPolicyUrl: urls?.privacyPolicyUrl ?? null,
        supportUrl: urls?.supportUrl ?? null,
      }

      apps.push({ ...app, copyText: buildCopyText(app) })
    }
  }

  return apps.sort((a, b) => a.appPathLabel.localeCompare(b.appPathLabel))
}
