export const dynamic = 'force-dynamic'

import PostLogForm from '@/components/PostLogForm'
import SectionCard from '@/components/SectionCard'
import { getEngagement } from '@/lib/metrics'
import { readPosts } from '@/lib/store'

export default async function PostsPage() {
  const posts = await readPosts()

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <SectionCard title="投稿ログ" description="投稿後の数値を手動で登録します。">
        <PostLogForm />
      </SectionCard>

      <SectionCard title="投稿履歴" description={`${posts.length}件`}>
        <div className="space-y-3">
          {posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-slate-500">投稿ログ未登録です。</p>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">{post.platform}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">{post.category}</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600">score {getEngagement(post)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post.content}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600 sm:grid-cols-6">
                  <Metric label="imp" value={post.impressions} />
                  <Metric label="like" value={post.likes} />
                  <Metric label="book" value={post.bookmarks} />
                  <Metric label="reply" value={post.replies} />
                  <Metric label="follow" value={post.follows} />
                  <Metric label="date" value={new Date(post.postedAt).toLocaleDateString('ja-JP')} />
                </div>
              </article>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <p className="font-medium text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  )
}
