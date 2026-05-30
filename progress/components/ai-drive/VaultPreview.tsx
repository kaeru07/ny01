import type { VaultPreview } from '@/types/ai-drive'

const statusStyle = {
  not_connected: { label: '未接続', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
  mock: { label: 'モック', bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' },
  synced: { label: '同期済み', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
}

interface Props {
  preview: VaultPreview
}

export default function VaultPreviewPanel({ preview }: Props) {
  const conn = statusStyle[preview.connectionStatus]
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">Vault連携プレビュー</h2>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${conn.bg} ${conn.text}`}>
          Vault読み込み: {conn.label}
        </span>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-3">
        <div>
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">読み込み元候補</div>
          <ul className="space-y-1.5">
            {preview.sources.map((s) => {
              const st = statusStyle[s.status]
              return (
                <li
                  key={s.path}
                  className="flex items-start justify-between gap-2 text-[12px] leading-relaxed"
                >
                  <div className="min-w-0 flex-1">
                    <code className="text-blue-600 dark:text-blue-400 font-mono text-[11px] break-all">{s.path}</code>
                    <div className="text-gray-500 dark:text-gray-400 text-[11px]">{s.purpose}</div>
                  </div>
                  <span
                    className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${st.bg} ${st.text}`}
                  >
                    {st.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">最終同期</div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{preview.lastSync}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">Vault反映待ち</div>
            <div className="text-sm font-semibold text-teal-600 dark:text-teal-400 mt-0.5">{preview.reflectPending}件</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">保存予定MD</div>
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
              {preview.saveMarkdownReady ? 'あり' : 'なし'}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 dark:text-gray-500 pt-1">
          ※ v1 モック / 本実装で `/api/ai-drive/vault` などを介して `obsidian-vault` を読み込む想定
        </p>
      </div>
    </section>
  )
}
