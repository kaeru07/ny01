export const dynamic = 'force-dynamic'

import Link from 'next/link'
import SectionCard from '@/components/SectionCard'
import CopyButton from '@/components/CopyButton'
import { readAllData } from '@/lib/store'
import { getDashboardStats, getEngagement } from '@/lib/metrics'

export default async function DashboardPage() {
  const data = await readAllData()
  const stats = getDashboardStats(data)

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-ink p-5 text-white sm:p-6">
        <p className="text-sm font-medium text-blue-200">Local SNS Operations</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">AIトレンドを投稿可能な形まで管理する</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
          ニュース登録、投稿案生成、投稿ログ、週次振り返りをdata/*.jsonで管理します。外部投稿APIや認証は未実装です。
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="今日の投稿予定" value={`${stats.todaySchedule.length}件`} />
        <MetricCard label="未投稿数" value={`${stats.unpostedCount}件`} />
        <MetricCard label="今週の投稿数" value={`${stats.weeklyPostCount}件`} />
        <MetricCard label="ニュース登録数" value={`${data.news.length}件`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <SectionCard title="今日の投稿予定" description="今日生成した投稿案です。コピーして投稿準備に使えます。">
          <div className="space-y-3">
            {stats.todaySchedule.length === 0 ? (
              <EmptyState href="/ideas" text="投稿案を生成する" />
            ) : (
              stats.todaySchedule.map((idea) => (
                <div key={idea.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{idea.type}</p>
                      <p className="mt-1 text-sm font-bold text-ink">{idea.title}</p>
                    </div>
                    <CopyButton text={idea.content} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="反応が良かった投稿" description="likes/bookmarks/replies/followsから簡易スコアで表示します。">
          <div className="space-y-3">
            {stats.bestPosts.length === 0 ? (
              <EmptyState href="/posts" text="投稿ログを登録する" />
            ) : (
              stats.bestPosts.map((post) => (
                <article key={post.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-500">{post.platform}</p>
                    <p className="text-xs font-bold text-blue-600">score {getEngagement(post)}</p>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{post.content}</p>
                </article>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  )
}

function EmptyState({ href, text }: { href: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-5 text-center">
      <p className="text-sm text-slate-500">まだデータがありません。</p>
      <Link href={href} className="mt-3 inline-flex rounded-lg bg-ink px-3 py-2 text-sm font-bold text-white">
        {text}
      </Link>
    </div>
  )
}
