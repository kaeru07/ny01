const DEFAULT_APP_CWD = '/root/company/apps/ny01/progress'

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
  return APP_CWD_BY_TARGET.get(key) ?? null
}
