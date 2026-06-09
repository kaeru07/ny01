import Link from "next/link";
import { getTopicsByTag } from "@/lib/research/vault";
import { TopicListItem } from "@/components/research/TopicListItem";

export const revalidate = 60;

interface Props {
  params: { tag: string };
}

export default async function TagPage({ params }: Props) {
  const tag = decodeURIComponent(params.tag).replace(/^#/, "");
  const refs = await getTopicsByTag(tag);
  if (refs.length === 0) {
    // タグが存在しないか Topic 0 件 → 404 ではなく空表示にする
    return (
      <TagShell tag={tag}>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="text-sm">#{tag} のトピックは見つかりませんでした。</p>
        </div>
      </TagShell>
    );
  }

  return (
    <TagShell tag={tag}>
      <p className="text-xs text-gray-500 mb-3">{refs.length} 件のトピック</p>
      <div className="space-y-3">
        {refs.map((r) => (
          <TopicListItem key={`${r.date}-${r.topic.topicId}`} refItem={r} />
        ))}
      </div>
    </TagShell>
  );
}

function TagShell({ tag, children }: { tag: string; children: React.ReactNode }) {
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
            🏷️ #{tag}
          </span>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">{children}</main>
      <div className="h-8" />
    </div>
  );
}
