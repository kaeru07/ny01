export const dynamic = 'force-dynamic'

import NewsForm from '@/components/NewsForm'
import SectionCard from '@/components/SectionCard'
import { readNews } from '@/lib/store'

export default async function NewsPage() {
  const news = await readNews()

  return (
    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
      <SectionCard title="ニュース登録" description="出典URLを残し、個人開発者への関係性をmemoに残します。">
        <NewsForm />
      </SectionCard>

      <SectionCard title="登録済みニュース" description={`${news.length}件`}>
        <div className="space-y-3">
          {news.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-slate-500">ニュース未登録です。</p>
          ) : (
            news.map((item) => (
              <article key={item.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">{item.category}</span>
                  <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">重要度 {item.importance}</span>
                  <span className="text-slate-400">{new Date(item.createdAt).toLocaleString('ja-JP')}</span>
                </div>
                <h2 className="mt-2 text-base font-bold text-ink">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summary}</p>
                {item.memo && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{item.memo}</p>}
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 block break-all text-sm font-medium text-blue-600">
                  {item.sourceName}: {item.sourceUrl}
                </a>
              </article>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  )
}
