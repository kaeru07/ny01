export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getEpics, getPendingApprovals } from '@/lib/operations-store'
import { evaluateFactoryEligibility, describeFactory } from '@/lib/epic-contract'
import FactoryGuideModal from '@/components/epic/FactoryGuideModal'
import FactoryStatusBar from '@/components/epic/FactoryStatusBar'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: '実行中', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  paused: { label: '停止中', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  blocked: { label: 'ブロック中', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  done: { label: '完了', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

export default async function EpicIndexPage() {
  const [epics, pending] = await Promise.all([getEpics(), getPendingApprovals()])
  const pendingByEpic = new Map<string, number>()
  for (const a of pending) {
    if (a.epicId) pendingByEpic.set(a.epicId, (pendingByEpic.get(a.epicId) ?? 0) + 1)
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI工場</h1>
          <FactoryGuideModal />
        </div>
        <p className="mt-0.5 text-sm text-gray-400">Epic（案件）単位で前回作業・決定・次回予定・承認待ちを確認する</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href="/epic/new"
            className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            ＋ Epic を作成（契約形式）
          </Link>
          <Link
            href="/factory/candidates"
            className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            アプリ開発候補キュー →
          </Link>
        </div>
      </header>

      {/* 現在地表示: いま何をすればいいか（既存データから判定） */}
      <FactoryStatusBar />

      {/* 初見ユーザー向けの運用導線 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">ここは AI 作業を管理する場所です</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          Epic を開く → AI に作業させる → 結果レビュー → 承認 → 次の作業、の順で進みます。
          各ボタンの使い方や Claude 上限時の流れは「工場の使い方」を確認してください。
        </p>
        <div className="mt-2">
          <FactoryGuideModal />
        </div>
      </div>

      {epics.length === 0 ? (
        <p className="text-sm text-gray-400">Epic がまだありません。</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {epics.map((e) => {
            const p = pendingByEpic.get(e.epicId) ?? 0
            const s = STATUS_LABEL[e.status] ?? STATUS_LABEL.paused
            const elig = evaluateFactoryEligibility(e, { pendingApprovalCount: p })
            const fd = describeFactory(elig)
            return (
              <li key={e.epicId}>
                <Link
                  href={`/epic/${e.epicId}`}
                  className="block h-full rounded-2xl border border-gray-200 bg-white p-3 transition-colors hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-3 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">{e.title}</h2>
                    {p > 0 ? (
                      <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                        承認待ち {p}
                      </span>
                    ) : (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{e.goal}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${fd.managed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {fd.primaryLabel}
                    </span>
                    {fd.secondaryLabel && (
                      <span
                        title={fd.detail}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${fd.needsApproval ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}
                      >
                        {fd.secondaryLabel}
                      </span>
                    )}
                    {fd.cautionLabel && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        {fd.cautionLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <span>{e.progress}%</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, e.progress))}%` }} />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
