import Link from "next/link";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/research/types";
import {
  collectAllTags,
  collectTodoCandidateTopics,
  getResearchScanMeta,
  readIndexHistory,
  summarizeCategories,
} from "@/lib/research/vault";
import { RescanButton } from "@/components/research/RescanButton";

// 毎回 Vault を再スキャンして最新日次を反映する（旧 revalidate=60 だと古い copy が残った）
export const dynamic = "force-dynamic";

const ROOT_KIND_LABEL: Record<string, string> = {
  env: "環境変数指定",
  vault: "Vault本体",
  bundled: "同梱コピー",
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  ok: { text: "最新", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  stale: { text: "古い可能性", cls: "text-amber-700 bg-amber-50 border-amber-200" },
  empty: { text: "0件", cls: "text-red-700 bg-red-50 border-red-200" },
};

export default async function ResearchOverviewPage() {
  const [summaries, indexHistory, topTags, todoCandidates, scanMeta] =
    await Promise.all([
      summarizeCategories(),
      readIndexHistory(7),
      collectAllTags(),
      collectTodoCandidateTopics(),
      getResearchScanMeta(),
    ]);

  const summaryMap = new Map(summaries.map((s) => [s.category, s]));
  const status = STATUS_LABEL[scanMeta.status] ?? STATUS_LABEL.ok;
  const scannedAtLabel = new Date(scanMeta.scannedAt).toLocaleString("ja-JP", {
    hour12: false,
  });

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
        <section className="mb-4 bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-700">
              スキャン状態
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${status.cls}`}
              >
                {status.text}
              </span>
              <RescanButton />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div className="flex flex-col">
              <dt className="text-gray-400">最新ファイル日付</dt>
              <dd className="font-mono font-semibold text-gray-800">
                {scanMeta.latestDate ?? "—"}
                {typeof scanMeta.latestAgeDays === "number" && (
                  <span className="ml-1 font-sans font-normal text-gray-400">
                    ({scanMeta.latestAgeDays}日前)
                  </span>
                )}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-gray-400">読み込みMarkdown件数</dt>
              <dd className="font-semibold text-gray-800">
                {scanMeta.totalDocs} 件
                {scanMeta.partialCount > 0 && (
                  <span className="ml-1 text-amber-600">
                    (partial {scanMeta.partialCount})
                  </span>
                )}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-gray-400">最終スキャン日時</dt>
              <dd className="font-mono text-gray-700">{scannedAtLabel}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-gray-400">参照中ルート</dt>
              <dd className="text-gray-700">
                {ROOT_KIND_LABEL[scanMeta.rootKind] ?? scanMeta.rootKind}
              </dd>
            </div>
          </dl>
          <p className="text-[10px] text-gray-400 break-all leading-relaxed border-t border-gray-50 pt-2">
            参照中Vaultパス:{" "}
            <code className="px-1 bg-slate-100 rounded">{scanMeta.root}</code>
          </p>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Hermes/Codex が生成した Vault Markdown を閲覧します（読み取り専用）。
          </p>
        </section>

        <section className="mb-5 space-y-3">
          <Link
            href="/research/todo-candidates"
            className="block active:scale-[0.99] transition-transform"
          >
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-800">
                ✅ ToDo候補
              </span>
              <span className="text-sm font-bold text-emerald-700">
                {todoCandidates.length} 件 →
              </span>
            </div>
          </Link>

          {topTags.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">🏷️ タグで探す</p>
              <div className="flex flex-wrap gap-1.5">
                {topTags.slice(0, 12).map(({ tag, count }) => (
                  <Link
                    key={tag}
                    href={`/research/tag/${encodeURIComponent(tag)}`}
                    className="text-[11px] text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5 break-all active:bg-sky-100"
                  >
                    #{tag} {count}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

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
                      {summary?.latestTopicCount ? (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                              Topics {summary.latestTopicCount}
                            </span>
                            {!!summary.latestSCount && (
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                                S {summary.latestSCount}
                              </span>
                            )}
                            {!!summary.latestACount && (
                              <span className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                                A {summary.latestACount}
                              </span>
                            )}
                            {!!summary.latestTodoCount && (
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                Todo {summary.latestTodoCount}
                              </span>
                            )}
                            {!!summary.latestStaleCount && (
                              <span className="text-[11px] font-semibold text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-full px-2 py-0.5">
                                Stale {summary.latestStaleCount}
                              </span>
                            )}
                            {summary.latestTopTags?.slice(0, 3).map((t, i) => (
                              <span key={i} className="text-[11px] text-sky-700 break-all">
                                #{t}
                              </span>
                            ))}
                          </div>
                          {summary.latestTlDr && (
                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                              <span className="text-gray-400">TL;DR: </span>
                              {summary.latestTlDr}
                            </p>
                          )}
                        </div>
                      ) : null}
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

