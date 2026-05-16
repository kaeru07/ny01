import { checkCodexStatus, getActiveRun } from '@/lib/codex-runner'

export default async function CodexStatusCard() {
  const status = await checkCodexStatus()
  const active = getActiveRun()

  return (
    <div
      className={`rounded-2xl border p-4 space-y-2 ${
        status.ok
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
          : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            status.ok ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Codex CLI 状態: {status.ok ? '利用可能' : '利用不可'}
        </p>
      </div>
      {!status.ok && status.reason && (
        <p className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">
          {status.reason}
        </p>
      )}
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        <dt>binary</dt>
        <dd className="font-mono break-all">{status.binaryPath ?? '-'}</dd>
        <dt>version</dt>
        <dd className="font-mono">{status.version ?? '-'}</dd>
        <dt>login</dt>
        <dd className="font-mono">{status.login ?? 'unknown'}</dd>
        <dt>実行中</dt>
        <dd className="font-mono">{active ? active.runId : 'なし'}</dd>
      </dl>
    </div>
  )
}
