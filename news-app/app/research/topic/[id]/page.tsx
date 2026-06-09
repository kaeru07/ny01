import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_META } from "@/lib/research/types";
import {
  getDuplicateCandidates,
  getTimelineFor,
  getTopicById,
} from "@/lib/research/vault";
import { TopicCard } from "@/components/research/TopicCard";

export const revalidate = 60;

interface Props {
  params: { id: string };
}

export default async function TopicDetailPage({ params }: Props) {
  const id = decodeURIComponent(params.id);
  const ref = await getTopicById(id);
  if (!ref) notFound();

  const [timeline, duplicates] = await Promise.all([
    getTimelineFor(ref),
    getDuplicateCandidates(ref),
  ]);
  const meta = CATEGORY_META[ref.category];
  const timelineOthers = timeline.filter(
    (t) => !(t.date === ref.date && t.topic.topicId === ref.topic.topicId)
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href={`/research/${ref.category}/${ref.date}`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
          >
            ←
          </Link>
          <span className="text-base">{meta.emoji}</span>
          <span className="text-sm font-semibold text-gray-900 truncate">
            Topic / {ref.date}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
        <p className="text-[11px] text-gray-400 font-mono break-all">
          {meta.label} / {ref.date} / topicId: {ref.topic.topicId}
        </p>

        <TopicCard topic={ref.topic} docDate={ref.date} permalink={false} />

        {ref.topic.timelineKey && (
          <p className="text-[11px] text-gray-400 px-1">
            timelineKey: <span className="font-mono">{ref.topic.timelineKey}</span>
          </p>
        )}

        {timelineOthers.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">
              🕒 関連Timeline（{timelineOthers.length}）
            </h2>
            <ol className="space-y-2.5">
              {timelineOthers.map((t) => (
                <li key={`${t.date}-${t.topic.topicId}`}>
                  <Link
                    href={`/research/topic/${encodeURIComponent(t.topic.topicId ?? "")}`}
                    className="block active:bg-gray-50 rounded-lg -mx-1 px-1"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap">
                        {t.date}
                      </span>
                      <span className="text-sm text-gray-800 leading-snug break-words line-clamp-2">
                        {t.topic.summaryTlDr ?? t.topic.title}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        {duplicates.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-1">
              🔁 重複候補（{duplicates.length}）
            </h2>
            <p className="text-[11px] text-gray-400 mb-3">
              duplicateKey が一致する Topic（AI 判定なし）
            </p>
            <ol className="space-y-2.5">
              {duplicates.map((t) => (
                <li key={`${t.date}-${t.topic.topicId}`}>
                  <Link
                    href={`/research/topic/${encodeURIComponent(t.topic.topicId ?? "")}`}
                    className="block active:bg-gray-50 rounded-lg -mx-1 px-1"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] text-gray-400 font-mono whitespace-nowrap">
                        {t.date}
                      </span>
                      <span className="text-sm text-gray-800 leading-snug break-words line-clamp-2">
                        {t.topic.title}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      <div className="h-8" />
    </div>
  );
}
