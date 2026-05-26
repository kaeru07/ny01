import Link from "next/link";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/research/types";
import {
  readIndexHistory,
  summarizeCategories,
} from "@/lib/research/vault";

export const revalidate = 60;

export default async function ResearchOverviewPage() {
  const [summaries, indexHistory] = await Promise.all([
    summarizeCategories(),
    readIndexHistory(7),
  ]);

  const summaryMap = new Map(summaries.map((s) => [s.category, s]));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
          >
            ←
          </Link>
          <span className="text-sm font-semibold text-gray-900">
            🗂️ 市場調査ビュー
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <p className="text-xs text-gray-500 leading-relaxed mb-4">
          Hermes/Codex が生成した Vault Markdown を閲覧します。原本は
          <code className="mx-1 px-1 py-0.5 bg-slate-100 rounded text-[10px]">
            obsidian-vault/06_research/
          </code>
          配下。本画面は読み取り専用です。
        </p>

        <section className="space-y-3 mb-6">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            const summary = summaryMap.get(cat);
            return (
              <Link
                key={cat}
                href={`/research/${cat}`}
                className="block active:scale-[0.98] transition-transform"
              >
                <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{meta.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-bold text-gray-900">
                          {meta.label}
                        </h3>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {summary?.count ?? 0} 件
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {meta.description}
                      </p>
                      {summary?.latestDate && (
                        <p className="text-xs text-gray-400 mt-2 font-mono">
                          最新: {summary.latestDate}
                          {summary.partial && (
                            <span className="ml-2 text-amber-600">partial</span>
                          )}
                          {summary.hasError && (
                            <span className="ml-2 text-red-600">error</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </section>

        {indexHistory.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1">
              <span>🗒️</span>
              <span>インデックス（最新 {indexHistory.length} 件）</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-gray-600">
              {indexHistory.map((line, idx) => (
                <li key={idx} className="leading-relaxed break-words">
                  {line.replace(/^-\s*/, "")}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-gray-400 mt-3">
              原本: 06_research/market-research-index.md
            </p>
          </section>
        )}
      </main>

      <div className="h-8" />
    </div>
  );
}

