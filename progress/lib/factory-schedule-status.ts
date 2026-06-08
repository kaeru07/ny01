import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execFileAsync = promisify(execFile)

// factory-schedule-status: スケジューラ（systemd timer / boot service）の状態を「読み取り専用」で取得する。
// systemctl を read-only で問い合わせるだけ。unit の設置・enable・start は一切しない（P3 同様ユーザー判断）。
// 失敗（systemd 無し / 権限無し / 未インストール）時は安全なデフォルト（未設定）を返す。

const TIMER_UNIT = 'factory-schedule.timer'
const BOOT_UNIT = 'factory-schedule-boot.service'
const REPO_TIMER_FILE = path.join(
  process.cwd(),
  'docs/factory-schedule/factory-schedule.timer',
)

export interface FactoryScheduleStatus {
  /** timer unit が systemd に enable 済みか。 */
  timerEnabled: boolean
  /** boot service が enable 済みか。 */
  bootEnabled: boolean
  /** 次回起動時刻（ISO 文字列）。取得不能なら null（= 未設定表示）。 */
  nextRunAt: string | null
  /** 設定上の定時（"11:00" / 複数なら "11:00 / 23:00"）。repo の unit 定義から読む。取得不能なら null。 */
  dailyTime: string | null
}

const DEFAULT_STATUS: FactoryScheduleStatus = {
  timerEnabled: false,
  bootEnabled: false,
  nextRunAt: null,
  dailyTime: null,
}

async function systemctl(args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('systemctl', args, { timeout: 3000 })
    return stdout.trim()
  } catch {
    return null
  }
}

async function isEnabled(unit: string): Promise<boolean> {
  // is-enabled は enabled のとき exit 0、それ以外は非0 で execFile が reject する。
  const out = await systemctl(['is-enabled', unit])
  return out === 'enabled' || out === 'enabled-runtime' || out === 'static'
}

/** timer が active なら次回起動時刻を ISO で返す。未インストール / inactive なら null。 */
async function nextRun(): Promise<string | null> {
  const out = await systemctl([
    'show',
    TIMER_UNIT,
    '-p',
    'NextElapseUSecRealtime',
    '--value',
  ])
  if (!out) return null
  // 例: "Tue 2026-06-02 11:00:00 JST" / 未スケジュール時は空 or "n/a"。
  if (out === '' || out === 'n/a' || out.toLowerCase().includes('infinity')) return null
  return parseSystemdTime(out)
}

/**
 * systemd の時刻文字列を ISO へ変換する。
 * systemd は "Tue 2026-06-02 11:00:00 JST" のようにホスト TZ の略称（JST 等）を付ける。
 * JS の Date は "JST" 等の略称を解釈できず Invalid Date になるため、
 * 1) まず素の Date を試し、2) ダメなら末尾の TZ 略称トークンを除去してローカル TZ で解釈する。
 * （systemd はホストローカル時刻で出力し、本 VPS の TZ は Asia/Tokyo なのでローカル解釈で一致する。）
 */
function parseSystemdTime(raw: string): string | null {
  const direct = new Date(raw)
  if (!Number.isNaN(direct.getTime())) return direct.toISOString()

  // 先頭の曜日（"Tue "）と末尾の TZ 略称（" JST" / " +0900" 等）を落とす。
  const stripped = raw
    .replace(/^[A-Za-z]{3}\s+/, '')
    .replace(/\s+[A-Za-z]{2,5}$/, '')
    .trim()
  const local = new Date(stripped)
  if (!Number.isNaN(local.getTime())) return local.toISOString()
  return null
}

/** repo の timer unit 定義から全 OnCalendar の時刻（HH:MM）を読む（複数行対応）。
 *  例: 11:00 + 23:00 → "11:00 / 23:00"。取得不能なら null。 */
async function dailyTimeFromUnit(): Promise<string | null> {
  try {
    const content = await fs.readFile(REPO_TIMER_FILE, 'utf-8')
    const times: string[] = []
    const re = /OnCalendar=.*?(\d{2}:\d{2})(?::\d{2})?/g
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) times.push(m[1])
    if (times.length === 0) return null
    return Array.from(new Set(times)).join(' / ')
  } catch {
    return null
  }
}

export async function getFactoryScheduleStatus(): Promise<FactoryScheduleStatus> {
  try {
    const [timerEnabled, bootEnabled, nextRunAt, dailyTime] = await Promise.all([
      isEnabled(TIMER_UNIT),
      isEnabled(BOOT_UNIT),
      nextRun(),
      dailyTimeFromUnit(),
    ])
    return { timerEnabled, bootEnabled, nextRunAt, dailyTime }
  } catch {
    return DEFAULT_STATUS
  }
}
