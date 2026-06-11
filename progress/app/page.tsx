export const dynamic = 'force-dynamic'

import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'
import { buildCommandCenter } from '@/lib/command-center'

// 新UXのトップ = 司令塔。毎日最初に開く画面。
// 「今日の5〜15分をどう使うか」だけが分かることを最優先にする。専門用語は出さない。
// 旧ダッシュボードは /legacy/home に退避済み（機能・データは無削除）。

const toneClass: Record<string, string> = {
  ok: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  alert: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
}

const actionIcon: Record<string, string> = {
  judge: '🙋',
  ai: '🤖',
  user_work: '🛠',
}

export default async function CommandCenterPage() {
  const view = await buildCommandCenter()
  const todayLabel = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  const currentMilestone = view.milestones.find((m) => m.state === 'current')
  const doneCount = view.milestones.filter((m) => m.state === 'done').length

  return (
    <div className="space-y-6 px-4 pb-6 pt-6">
      <PageGuide
        title="司令塔"
        guide="このページを見るだけで今日やることが分かります。所要時間の目安は5〜15分です。"
      />
      <p className="-mt-3 text-sm text-gray-400 dark:text-gray-500">{todayLabel}</p>

      {/* 今日やること */}
      <section className="rounded-xl border-2 border-blue-200 bg-white p-4 dark:border-blue-900/50 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">今日やること</h2>
        <ul className="mt-3 space-y-2">
          {view.todayActions.map((action, i) => (
            <li key={i}>
              <Link
                href={action.href ?? '/decide'}
                className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
              >
                <span className="text-lg">{actionIcon[action.kind]}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{action.title}</span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{action.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* AI工場の状態 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI工場の状態</h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${toneClass[view.factory.statusTone]}`}>
            {view.factory.statusLabel}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{view.factory.description}</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">自動化率</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{view.factory.automationRatePct}%</p>
            <p className="text-[11px] leading-relaxed text-gray-400">AIが人間の介入なしで作業を終え、学習まで残せた割合</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">未確認の作業履歴</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{view.factory.notReviewedCount}件</p>
            <p className="text-[11px] leading-relaxed text-gray-400">たまるとAI工場が自動で減速します</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">{view.factory.lastResultText}</p>
        {view.factory.lastErrorText && (
          <p className="mt-1 text-[11px] font-semibold text-amber-600">{view.factory.lastErrorText}</p>
        )}
      </section>

      {/* 収益化までの残距離 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">収益化までの残距離</h2>
          <Link href="/revenue" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">詳しく見る</Link>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">現在 ¥0</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          次の一歩: <span className="font-semibold text-gray-900 dark:text-gray-100">{currentMilestone?.label ?? 'すべて完了'}</span>
          （ゴールまで残り{view.milestones.length - doneCount}ステップ）
        </p>
      </section>

      {/* 今日の判断事項 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">今日の判断事項（{view.decisionCount}件）</h2>
          <Link href="/decide" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">Inboxで処理する</Link>
        </div>
        {view.decisions.length === 0 ? (
          <p className="mt-2 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-800/50">今日の判断事項はありません。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {view.decisions.map((d) => (
              <li key={d.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <p className="text-[11px] font-semibold text-rose-500">{d.kind}</p>
                <p className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">{d.title}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 最近の成果 */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">最近の成果</h2>
        <ul className="mt-2 space-y-2">
          {view.recentWins.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 text-xs text-gray-400">{w.date}</span>
              <span className="min-w-0">
                <span className="text-gray-900 dark:text-gray-100">{w.title}</span>
                <span className="ml-1 text-xs text-gray-400">（{w.app}）</span>
              </span>
            </li>
          ))}
          {view.recentWins.length === 0 && <li className="text-sm text-gray-400">まだ成果がありません。</li>}
        </ul>
      </section>

      <p className="text-center text-[11px] text-gray-400">
        細かい管理画面は <Link href="/legacy" className="underline">Legacy（旧画面）</Link> にあります
      </p>
    </div>
  )
}
