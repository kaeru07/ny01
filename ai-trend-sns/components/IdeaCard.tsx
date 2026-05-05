import type { ContentIdea } from '@/types/sns'
import CopyButton from './CopyButton'

const typeLabel = {
  x: 'X投稿案',
  shorts: 'Shorts台本',
  note: 'note記事案',
}

export default function IdeaCard({ idea }: { idea: ContentIdea }) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{typeLabel[idea.type]}</span>
          <h3 className="mt-2 text-base font-bold text-ink">{idea.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{new Date(idea.createdAt).toLocaleString('ja-JP')}</p>
        </div>
        <CopyButton text={idea.content} />
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{idea.content}</p>
    </article>
  )
}
