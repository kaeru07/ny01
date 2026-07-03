import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { GENERATED_APPS_ROOT } from './app-paths'
import { appendAutomationLog } from './operations-store'

const execFileAsync = promisify(execFile)
const SAFE_PROJECT_ID_RE = /^[a-z0-9-]+$/

export interface AppWorkspaceResult {
  created: boolean
  path: string
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory()
  } catch {
    return false
  }
}

export async function ensureAppWorkspace(projectId: string, appName: string): Promise<AppWorkspaceResult | null> {
  const safeProjectId = projectId.trim()
  if (!SAFE_PROJECT_ID_RE.test(safeProjectId)) return null

  const workspacePath = path.join(GENERATED_APPS_ROOT, safeProjectId)
  if (await directoryExists(workspacePath)) {
    return { created: false, path: workspacePath }
  }

  await fs.mkdir(workspacePath, { recursive: true })
  const readme = [
    `# ${appName.trim() || safeProjectId}`,
    '',
    `目的: ${appName.trim() || safeProjectId}`,
    '',
    'このワークスペースはprogressの自動実行が使用します。ストア提出可能品質まで自動で開発されます（提出のみユーザー操作）。',
    '',
  ].join('\n')
  await fs.writeFile(path.join(workspacePath, 'README.md'), readme, 'utf-8')

  try {
    await execFileAsync('git', ['init'], { cwd: workspacePath })
  } catch {
    // git init は利便性の初期化だけなので、失敗してもワークスペース自体は利用可能。
  }

  await appendAutomationLog({
    event: 'app_workspace_created',
    fallbackReason: `${safeProjectId} at ${workspacePath}`,
  })

  return { created: true, path: workspacePath }
}
