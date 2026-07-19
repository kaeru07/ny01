import { StructuredResearch } from "@/lib/research/types";
import { MarkdownView } from "./MarkdownView";
import { TopicCard } from "./TopicCard";

interface Props {
  data: StructuredResearch;
  docDate: string;
}

export function StructuredResearchView({ data, docDate }: Props) {
  const conclusionLines = data.conclusion
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return (
    <div className="space-y-4">
      {conclusionLines.length > 0 && (
        <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-semibold tracking-widest text-slate-300 mb-2">
            今日の結論
          </p>
          <div className="space-y-1.5">
            {conclusionLines.map((line, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-slate-50 break-words">
                {line}
              </p>
            ))}
          </div>
        </section>
      )}

      {data.articleBody.trim().length > 0 && (
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-3">
            記事本文
          </p>
          <div className="prose-sm">
            <MarkdownView markdown={data.articleBody} />
          </div>
        </article>
      )}

      {data.topics.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 px-1 mb-2">
            トピック {data.topics.length} 件
          </p>
          <div className="space-y-4">
            {data.topics.map((t) => (
              <TopicCard key={t.index} topic={t} docDate={docDate} />
            ))}
          </div>
        </div>
      )}

      {data.todos.length > 0 && (
        <ListSection
          title="今日のToDo候補"
          emoji="✅"
          items={data.todos}
          itemClass="text-sm text-gray-800"
        />
      )}

      {data.pending.length > 0 && (
        <ListSection
          title="保留・未確認"
          emoji="⏳"
          items={data.pending}
          itemClass="text-sm text-gray-600"
        />
      )}

      {data.restMarkdown.trim().length > 0 && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 mb-3">
            調査メモ
          </p>
          <MarkdownView markdown={data.restMarkdown} />
        </section>
      )}
    </div>
  );
}

function ListSection({
  title,
  emoji,
  items,
  itemClass,
}: {
  title: string;
  emoji: string;
  items: string[];
  itemClass: string;
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <p className="text-sm font-bold text-gray-900 mb-3">
        {emoji} {title}
      </p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className={`leading-relaxed break-words flex gap-2 ${itemClass}`}>
            <span className="text-gray-300 select-none">・</span>
            <span className="flex-1">{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
