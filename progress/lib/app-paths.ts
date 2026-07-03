import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_APP_CWD = '/root/company/apps/ny01/progress'
export const GENERATED_APPS_ROOT = '/root/company/apps/generated'

const APP_CWD_BY_TARGET = new Map<string, string>([
  ['progress', DEFAULT_APP_CWD],
  ['ny01/progress', DEFAULT_APP_CWD],
  ['company-mgmt', DEFAULT_APP_CWD],
  ['try-research', DEFAULT_APP_CWD],
  ['autoexec-test-proj', DEFAULT_APP_CWD],
  ['news-app', '/root/company/apps/ny01/news-app'],
  ['ny01-news-app', '/root/company/apps/ny01/news-app'],
  ['anglerlog', '/root/company/apps/ny01/anglerlog'],
  ['birdlog', '/root/company/apps/ny01/birdlog'],
  ['mahjong', '/root/company/apps/mahjong'],
])

export function resolveAppCwd(targetApp?: string | null): string | null {
  const key = targetApp?.trim()
  if (!key) return DEFAULT_APP_CWD
  const mapped = APP_CWD_BY_TARGET.get(key)
  if (mapped) return mapped
  if (!/^[a-z0-9-]+$/.test(key)) return null
  const generatedPath = path.join(GENERATED_APPS_ROOT, key)
  return fs.existsSync(generatedPath) && fs.statSync(generatedPath).isDirectory() ? generatedPath : null
}
