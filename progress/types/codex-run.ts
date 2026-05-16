export type CodexRunStatus = 'running' | 'completed' | 'failed' | 'timeout'

export type CodexSandbox = 'read-only' | 'workspace-write'

export interface CodexRun {
  runId: string
  startedAt: string
  finishedAt: string
  durationMs: number
  status: CodexRunStatus
  exitCode: number | null
  signal: string | null
  timeoutMs: number
  sandbox: CodexSandbox
  workingDir: string
  promptUsed: string
  targetTodoId?: string
  targetTodoTitle?: string
  queueItemId?: string
  projectId?: string
  projectName?: string
  command: string
  args: string[]
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
  errorMessage?: string
}

export interface CodexRunsData {
  runs: CodexRun[]
}

export interface CodexStatus {
  ok: boolean
  reason?: string
  binaryPath?: string
  version?: string
  login?: 'logged_in' | 'logged_out' | 'unknown'
  loginRaw?: string
}
