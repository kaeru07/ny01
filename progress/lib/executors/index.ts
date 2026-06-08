import type { ExecutorChoice } from '@/lib/types/operations'
import type { ExecutorAdapter } from './types'
import { manualAdapter } from './manual'
import { claudeAdapter } from './claude'
import { codexAdapter } from './codex'

// executor adapter レジストリ。将来 executor を増やすときはここに登録するだけ（executor 非依存）。
const ADAPTERS: Record<ExecutorChoice, ExecutorAdapter> = {
  manual: manualAdapter,
  claude: claudeAdapter,
  codex: codexAdapter,
}

export function getAdapter(name: ExecutorChoice): ExecutorAdapter {
  return ADAPTERS[name] ?? manualAdapter
}

export * from './types'
