export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'
import ReviewCopyButton from '@/components/review-copy/ReviewCopyButton'
import { buildCommandCenter, KIND_CHIP_LABEL } from '@/lib/command-center'
import { getAutoQueueView } from '@/lib/auto-queue'
import { computeFactoryStatus } from '@/lib/factory-status'
import { epicPriorityLabel } from '@/lib/epic-priority-label'
import { detectUrgentIssues } from '@/lib/urgent-issues'

// 新UXのトップ = 司令塔。毎日最初に開く画面。
// 「今日の5〜15分をどう使うか」だけが分かることを最優先にする。専門用語は出さない。
// 旧ダッシュボードは /legacy/home に退避済み（機能・データは無削除）。

const actionIcon: Record<string, string> = {
  judge: '🙋',
  ai: '🤖',
  user_work: '🛠',
}

const fixStageClass: Record<string, string> = {
  AI修正中: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  再確認待ち: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  検収: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

const autoQueueStatusLabel: Record<string, string> = {
  waiting_user: '人間判断待ち',
  ai_hold: 'AI保留中',
  review_waiting: 'レビュー互換',
  blocked: 'ブロック中',
  manual: '手動または対象外',
  done: '完了済み',
}

const urgentIssueClass = {
  high: {
    row: 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30',
    badge: 'bg-rose-700 text-white dark:bg-rose-500 dark:text-rose-950',
    title: 'text-rose-950 dark:text-rose-100',
    detail: 'text-rose-800/80 dark:text-rose-200/80',
    button: 'bg-rose-700 text-white hover:bg-rose-800 dark:bg-rose-500 dark:text-rose-950 dark:hover:bg-rose-400',
  },
  medium: {
    row: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/25',
    badge: 'bg-amber-600 text-white dark:bg-amber-400 dark:text-amber-950',
    title: 'text-amber-950 dark:text-amber-100',
    detail: 'text-amber-800/80 dark:text-amber-200/80',
    button: 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300',
  },
}

export default async function CommandCenterPage() {
  const [view, autoQueue, factoryStatus, urgentIssues] = await Promise.all([
    buildCommandCenter(),
    getAutoQueueView(),
    computeFactoryStatus(),
    detectUrgentIssues(),
  ])
  const executionFailure =
    autoQueue.counts.executable > 0 &&
    !factoryStatus.factoryEnabled
  const todayLabel = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  const currentMilestone = view.milestones.find((m) => m.state === 'current')
  const doneCount = view.milestones.filter((m) => m.state === 'done').length

  return (
    <div className="space-y-4 px-4 pb-5 pt-4">
      <section className="rounded-xl border-2 border-rose-300 bg-white p-3 shadow-sm dark:border-rose-900/70 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-gray-950 dark:text-gray-100">🚨 早急に対処が必要な問題</h2>
          {urgentIssues.length > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
              {urgentIssues.slice(0, 5).length}件
            </span>
          )}
        </div>
        {urgentIssues.length === 0 ? (
          <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-300">
            緊急の問題はありません
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {urgentIssues.slice(0, 5).map((issue) => {
              const tone = urgentIssueClass[issue.severity]
              return (
                <div key={issue.id} className={`rounded-lg border px-3 py-2 ${tone.row}`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${tone.badge}`}>
                          {issue.severity}
                        </span>
                        <p className={`text-sm font-black leading-snug ${tone.title}`}>{issue.title}</p>
                      </div>
                      <p className={`mt-1 text-xs font-semibold leading-relaxed ${tone.detail}`}>{issue.detail}</p>
                    </div>
                    {issue.actionLabel && issue.actionHref && (
                      <Link
                        href={issue.actionHref}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${tone.button}`}
                      >
                        {issue.actionLabel}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <PageGuide
        title="司令塔"
        guide="このページを見るだけで今日やることが分かります。所要時間の目安は5〜15分です。"
      />
      <p className="-mt-3 text-sm text-gray-400 dark:text-gray-500">{todayLabel}</p>
      <div className="-mt-3">
        <ReviewCopyButton />
      </div>

      {/* 一時導線: 旧Vault→今のゴール運用の対応表。統合完了後に撤去予定。 */}
      <Link
        href="/integration-map"
        className="flex items-center justify-between gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-900/20"
      >
        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200">🗺 旧Vault→今のゴール運用 対応表</span>
        <span className="shrink-0 rounded-full bg-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100">一時 →</span>
      </Link>

      {executionFailure && (
        <section className="rounded-xl border-2 border-rose-600 bg-rose-50 p-3 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          <p className="text-base font-black">自動実行できない異常状態です</p>
          <p className="mt-1 text-sm font-semibold">
            実行可能な作業が {autoQueue.counts.executable} 件ありますが、Factory が
            OFF のため定時実行されません。
          </p>
          <Link href="/automation" className="mt-3 inline-flex rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">
            Factory状態を確認
          </Link>
        </section>
      )}

      <section className="rounded-xl border-2 border-gray-900 bg-white p-3 dark:border-gray-100 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">次回自動実行予定</h2>
          <Link href="/queue" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">キュー調整</Link>
        </div>
        {autoQueue.next ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-gray-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">
                {autoQueue.next.preferredExecutor ?? 'executor未設定'}
              </span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                実行可能
              </span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                優先度{epicPriorityLabel(autoQueue.next.priority)}
              </span>
              {autoQueue.next.fixRequested && (
                <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                  要修正優先
                </span>
              )}
              {autoQueue.next.autonomyAnchor && (
                <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  自走化・最優先
                </span>
              )}
              {autoQueue.next.reviewPending && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  レビュー未確認・継続
                </span>
              )}
            </div>
            <p className="mt-2 text-lg font-bold leading-snug text-gray-900 dark:text-gray-100">{autoQueue.next.title}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Goal: {autoQueue.next.goalTitle ?? '未設定'} · doneCriteria {autoQueue.next.doneCriteriaDone}/{autoQueue.next.doneCriteriaTotal}
            </p>
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
              なぜ次か: {autoQueue.next.reason}
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            実行可能なEpicがありません。判断待ちまたは対象外の状態を確認してください。
          </p>
        )}

        {autoQueue.candidates.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-gray-400">次候補 / その次候補</p>
            <ol className="mt-2 space-y-1.5">
              {autoQueue.candidates.map((item) => (
                <li key={item.workItemId} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 text-xs font-bold text-gray-400">#{item.queueOrder}</span>
                  <span className="min-w-0 font-medium text-gray-800 dark:text-gray-100">{item.title}</span>
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">優先度{epicPriorityLabel(item.priority)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {autoQueue.pinnedExcluded.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/15">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">最優先指定中だが候補外</p>
            <ul className="mt-2 space-y-2">
              {autoQueue.pinnedExcluded.map((item) => (
                <li key={item.workItemId} className="text-sm">
                  <Link href="/queue" className="font-bold text-gray-900 underline decoration-amber-400 underline-offset-2 dark:text-gray-100">
                    {item.title}
                  </Link>
                  <p className="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Goal: {item.goalTitle ?? '未紐づけ'}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                    {autoQueueStatusLabel[item.status] ?? item.candidateBlockedReason ?? item.status}のため、次回自動実行候補には入りません。
                  </p>
                  {item.resolution && (
                    <div className="mt-1.5 rounded-md bg-white px-2.5 py-2 dark:bg-gray-900">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">こうすれば動きます</p>
                      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{item.resolution.how}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.resolution.actionLabel && item.resolution.actionHref && (
                          <Link
                            href={item.resolution.actionHref}
                            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                          >
                            {item.resolution.actionLabel}
                          </Link>
                        )}
                        <Link
                          href={`/decide?tab=review&goalId=${encodeURIComponent(item.goalId ?? 'unassigned')}`}
                          className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50 dark:border-amber-900/60 dark:bg-gray-900 dark:text-amber-200"
                        >
                          このゴールのレビュー一覧
                        </Link>
                        <Link
                          href="/queue"
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                          キュー調整
                        </Link>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ['判断待ち', autoQueue.counts.waiting_user, 'waiting_user'],
            ['AI保留', autoQueue.counts.ai_hold, 'ai_hold'],
            ['レビュー互換', autoQueue.counts.review_waiting, 'review_waiting'],
            ['実行可', autoQueue.counts.executable, 'executable'],
            ['Block', autoQueue.counts.blocked, 'blocked'],
          ].map(([label, count, key]) => (
            <Link key={key} href={`/queue?filter=${key}`} className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/60">
              <p className="text-[11px] font-semibold text-gray-400">{label}</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">{count}</p>
            </Link>
          ))}
        </div>

        {autoQueue.goalProgress.length > 0 && (
          <div className="mt-4">
            <Link href="/goal-dashboard" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
              ゴール別の進捗・配下todoの消化状況を見る →
            </Link>
          </div>
        )}
      </section>

      {view.factoryStopAlert && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-900/50 dark:bg-rose-900/15">
          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">
            ⚠ AI工場は{view.factoryStopAlert.days}日前から停止しています
          </p>
          <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">
            理由: {view.factoryStopAlert.reason}。<Link href="/decide" className="font-bold underline">Inboxで判断する</Link>
          </p>
        </section>
      )}

      {view.dataHealth.warningText && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-900/15">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {view.dataHealth.warningText}
          </p>
        </section>
      )}

      {/* 今日やること（今日の判断 最大3件 + その他のアクション） */}
      <section className="rounded-xl border-2 border-blue-200 bg-white p-3 dark:border-blue-900/50 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">今日やること</h2>
        <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
          今日の判断 残り{view.decisionCount}件
        </p>
        {view.todayDecisions.length === 0 && (
          <div className="mt-2">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 dark:bg-green-900/15 dark:text-green-300">
              🎉 工場を止める判断はありません。AI工場は稼働を続けます。
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              参考: レビュー{view.reviewTotal}件・候補{view.candidateTotal}件・AI保留{view.aiHoldCount}件（放置しても工場は止まりません）
            </p>
          </div>
        )}
        {view.todayDecisions.length > 0 && (
          <div className="mt-3">
            <ol className="space-y-1.5">
              {view.todayDecisions.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="shrink-0 font-bold text-blue-600 dark:text-blue-400">{['①', '②', '③'][i] ?? `${i + 1}.`}</span>
                  <span className="min-w-0">
                    <span className="mr-1.5 rounded bg-gray-100 px-1 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {KIND_CHIP_LABEL[d.kind]}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{d.headline}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">約{view.estimatedMinutes}分。これを処理すれば工場は止まりません</p>
            <p className="mt-1 text-[11px] text-gray-400">
              参考: レビュー{view.reviewTotal}件・候補{view.candidateTotal}件・AI保留{view.aiHoldCount}件（放置しても工場は止まりません）
            </p>
            <Link
              href="/decide"
              className="mt-2 block rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-blue-700"
            >
              Inboxを開く
            </Link>
          </div>
        )}
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {view.todayActions.map((action, i) => (
            <li key={i}>
              <Link
                href={action.href ?? '/decide'}
                className="flex h-full items-start gap-2 rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
              >
                <span className="text-base">{actionIcon[action.kind]}</span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-xs font-semibold leading-snug text-gray-900 dark:text-gray-100">{action.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] text-gray-500 dark:text-gray-400">{action.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 修正依頼の閉ループ */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">修正依頼</h2>
          <span className="text-xs font-semibold text-gray-400">{view.fixRequests.count}件</span>
        </div>
        {view.fixRequests.items.length === 0 ? (
          <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 dark:bg-green-900/15 dark:text-green-300">
            修正依頼中の作業はありません。
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {view.fixRequests.items.map((item, i) => (
              <li key={`${item.title}-${i}`} className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/50">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-snug text-gray-900 dark:text-gray-100">{item.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${fixStageClass[item.stage]}`}>{item.stage}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* AI保留の内訳 */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">AI保留の内訳</h2>
          <Link href="/decide" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">Inbox</Link>
        </div>
        {view.aiHoldBreakdown.length === 0 ? (
          <p className="mt-2 text-xs text-gray-400">AI保留はありません。</p>
        ) : (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {view.aiHoldBreakdown.slice(0, 5).map((h) => (
              <div key={h.label} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-gray-800/50">
                <dt className="line-clamp-2 text-[11px] font-semibold text-gray-700 dark:text-gray-200">{h.label}</dt>
                <dd className="text-sm font-bold text-gray-900 dark:text-gray-100">{h.count}件</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* 収益化までの残距離 */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">収益化までの残距離</h2>
          <Link href="/revenue" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">詳しく見る</Link>
        </div>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">現在 {view.currentRevenueText}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          次の一歩: <span className="font-semibold text-gray-900 dark:text-gray-100">{currentMilestone?.label ?? 'すべて完了'}</span>
          （ゴールまで残り{view.milestones.length - doneCount}ステップ）
        </p>
      </section>

      {/* 最近の成果 */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">最近の成果</h2>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {view.recentWins.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 text-xs text-gray-400">{w.date}</span>
              <span className="min-w-0">
                <span className="text-gray-900 dark:text-gray-100">{w.title}</span>
                <span className="ml-1 text-xs text-gray-400">（{w.app}）</span>
              </span>
            </li>
          ))}
          {view.recentWins.length === 0 && <li className="col-span-2 text-sm text-gray-400">まだ成果がありません。</li>}
        </ul>
      </section>

      {/* 最近の調査結果 */}
      <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">最近の調査結果</h2>
          <Link href="/monetization" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">調査一覧</Link>
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {view.recentResearch.map((item) => (
            <li key={`${item.candidateId}-${item.date}-${item.summary}`} className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800/50">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/monetization/${item.candidateId}`} className="line-clamp-2 min-w-0 text-xs font-bold leading-snug text-gray-900 hover:underline dark:text-gray-100">
                  {item.candidateName}
                </Link>
                <span className="shrink-0 text-xs text-gray-400">{item.date}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-gray-600 dark:text-gray-300">{item.summary}</p>
            </li>
          ))}
          {view.recentResearch.length === 0 && <li className="col-span-2 text-sm text-gray-400">まだ調査結果がありません。</li>}
        </ul>
      </section>

      <p className="text-center text-[11px] text-gray-400">
        細かい管理画面は <Link href="/legacy" className="underline">Legacy（旧画面）</Link> にあります
      </p>
    </div>
  )
}
