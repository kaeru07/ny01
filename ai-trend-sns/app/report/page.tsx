export const dynamic = 'force-dynamic'

import SectionCard from '@/components/SectionCard'
import { getEngagement, getWeeklyReport } from '@/lib/metrics'
import { readPosts } from '@/lib/store'

export default async function ReportPage() {
  const posts = await readPosts()
  const report = getWeeklyReport(posts)

  return (
    <div className="space-y-5">
      <SectionCard title="伸びた投稿TOP10" description="簡易スコア順です。">
        <div className="space-y-3">
          {report.topPosts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-slate-500">投稿ログを登録すると表示されます。</p>
          ) : (
            report.topPosts.map((post, index) => (
              <article key={post.id} className="rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-ink">#{index + 1} {post.platform}</p>
                  <p className="text-sm font-bold text-blue-600">score {getEngagement(post)}</p>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{post.content}</p>
              </article>
            ))
          )}
        </div>
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="伸びたカテゴリ">
          <div className="space-y-3">
            {report.topCategories.length === 0 ? (
              <p className="text-sm text-slate-500">まだカテゴリ分析できる投稿がありません。</p>
            ) : (
              report.topCategories.map((category) => (
                <div key={category.category} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-ink">{category.category}</p>
                    <p className="text-sm font-semibold text-blue-600">avg {category.average}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{category.count}投稿 / total score {category.score}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard title="次週やるべきテーマ">
          <ul className="space-y-3">
            {(report.nextThemes.length > 0 ? report.nextThemes : ['AIニュースを1日1件登録し、個人開発者向けの投稿案に変換する']).map((theme) => (
              <li key={theme} className="rounded-xl border border-line bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {theme}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}
