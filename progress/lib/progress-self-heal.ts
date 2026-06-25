import { spawn } from 'child_process'
import { closeSync, openSync, statSync, utimesSync } from 'fs'

import { resolveAppCwd } from './app-paths'

const LOCK_PATH = '/tmp/progress-self-heal.lock'
const LOCK_TTL_MS = 120_000

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function isLockFresh(): boolean {
  try {
    const stat = statSync(LOCK_PATH)
    return Date.now() - stat.mtimeMs < LOCK_TTL_MS
  } catch {
    return false
  }
}

function touchLock(): void {
  const fd = openSync(LOCK_PATH, 'a')
  closeSync(fd)
  const now = new Date()
  utimesSync(LOCK_PATH, now, now)
}

export function triggerProgressSelfHealIfNeeded(opts: { cwd: string; mode: string; confirm?: boolean }): void {
  try {
    const progressCwd = resolveAppCwd('progress')
    if (opts.mode !== 'auto' || opts.confirm !== true || !progressCwd || opts.cwd !== progressCwd) return
    if (isLockFresh()) return

    touchLock()
    const child = spawn('bash', ['-lc', `cd ${shellQuote(progressCwd)} && npm run build && pm2 restart progress`], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch (err) {
    console.warn('progress self-heal trigger failed:', err)
  }
}
