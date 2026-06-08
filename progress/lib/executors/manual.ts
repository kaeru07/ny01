import type { ExecutorAdapter, ExecutorResult, ExecutorRunInput } from './types'

// manual adapter: 実起動しない。プロンプトを人が実行する前提で「手動待ち」を返す。
// factory-runner の manual モードで使用（ExecutionRun 記録は別途 runner が行う）。
export const manualAdapter: ExecutorAdapter = {
  name: 'manual',
  async run(_input: ExecutorRunInput): Promise<ExecutorResult> {
    return {
      status: 'needs_manual',
      stdout: '',
      stderr: '',
      resultSummary: 'manual executor: プロンプトを人が実行し、結果を「実行結果を戻す」で登録してください',
      changedFiles: [],
      rateLimited: false,
      needsApproval: false,
      nextActions: [],
    }
  },
}
