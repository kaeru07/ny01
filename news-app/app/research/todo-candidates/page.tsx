import Link from "next/link";
import { collectTodoCandidateTopics } from "@/lib/research/vault";
import { toTodoCandidate } from "@/lib/research/summary";
import { TopicListItem } from "@/components/research/TopicListItem";

export const revalidate = 60;

export default async function TodoCandidatesPage() {
  const refs = await collectTodoCandidateTopics();
  const json = refs.map(toTodoCandidate);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/research"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
          >
            ←
          </Link>
          <span className="text-sm font-semibold text-gray-900 truncate">
            ✅ ToDo候補
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <p className="text-xs text-gray-500 leading-relaxed mb-4">
          各 Research Topic のうち「ToDo化: yes」のものを重要度順に抽出。Progress
          連携はまだ行わず、生成用 JSON shape の準備のみ。
        </p>

        {refs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm">ToDo化候補のトピックはまだありません。</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">{refs.length} 件</p>
            <div className="space-y-3">
              {refs.map((r) => (
                <TopicListItem key={`${r.date}-${r.topic.topicId}`} refItem={r} />
              ))}
            </div>

            <details className="mt-5 bg-white rounded-2xl border border-gray-100 p-4">
              <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
                ToDo候補 JSON（Progress 連携準備 / 生成 shape）
              </summary>
              <pre className="mt-3 bg-slate-900 text-slate-100 text-[11px] rounded-xl p-3 overflow-x-auto">
                <code>{JSON.stringify(json, null, 2)}</code>
              </pre>
            </details>
          </>
        )}
      </main>

      <div className="h-8" />
    </div>
  );
}
