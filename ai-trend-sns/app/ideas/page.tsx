export const dynamic = 'force-dynamic'

import IdeaCard from '@/components/IdeaCard'
import IdeaGenerator from '@/components/IdeaGenerator'
import SectionCard from '@/components/SectionCard'
import { readIdeas, readNews } from '@/lib/store'

export default async function IdeasPage() {
  const [ideas, news] = await Promise.all([readIdeas(), readNews()])

  return (
    <div className="space-y-5">
      <SectionCard title="投稿案生成" description={`登録ニュース ${news.length}件を元に、X投稿案・Shorts台本・note記事案を生成します。`}>
        <IdeaGenerator />
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-2">
        {ideas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center text-sm text-slate-500 lg:col-span-2">
            投稿案はまだありません。
          </div>
        ) : (
          ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} />)
        )}
      </section>
    </div>
  )
}
