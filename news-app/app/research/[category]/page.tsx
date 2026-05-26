import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  MonetizationHintEntry,
  ResearchCategory,
  UtilizationEntry,
} from "@/lib/research/types";
import {
  aggregateMonetizationHints,
  aggregateUtilization,
  listResearchDocs,
  readMarketResearchMethod,
  readPaperWatchlist,
} from "@/lib/research/vault";
import { ResearchClientList } from "@/components/research/ResearchClientList";
import { MarkdownView } from "@/components/research/MarkdownView";

export const revalidate = 60;

interface Props {
  params: { category: string };
}

function isValidCategory(value: string): value is ResearchCategory {
  return (CATEGORY_ORDER as readonly string[]).includes(value);
}

export default async function ResearchCategoryPage({ params }: Props) {
  const category = params.category;
  if (!isValidCategory(category)) notFound();

  const meta = CATEGORY_META[category];

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
          <span className="text-base">{meta.emoji}</span>
          <span className="text-sm font-semibold text-gray-900 truncate">
            {meta.label}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        <p className="text-xs text-gray-500 leading-relaxed mb-4">
          {meta.description}
        </p>

        {category === "monetization" ? (
          <MonetizationListServer />
        ) : category === "utilization" ? (
          <UtilizationListServer />
        ) : category === "papers" ? (
          <PapersListServer />
        ) : (
          <FileBackedListServer category={category} />
        )}
      </main>

      <div className="h-8" />
    </div>
  );
}

async function FileBackedListServer({
  category,
}: {
  category: Exclude<
    ResearchCategory,
    "monetization" | "utilization" | "papers"
  >;
}) {
  const docs = await listResearchDocs(category);

  if (category === "method") {
    const method = await readMarketResearchMethod();
    return (
      <>
        {method && (
          <details className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
            <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
              現在の調査方針 (market-research-method.md)
            </summary>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <MarkdownView markdown={method} />
            </div>
          </details>
        )}
        {docs.length === 0 ? (
          <EmptyDocsState />
        ) : (
          <ResearchClientList docs={docs} />
        )}
      </>
    );
  }

  if (docs.length === 0) {
    return <EmptyDocsState />;
  }
  return <ResearchClientList docs={docs} />;
}

async function MonetizationListServer() {
  const entries = await aggregateMonetizationHints();
  if (entries.length === 0) return <EmptyDocsState />;
  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <MonetizationCard key={e.date} entry={e} />
      ))}
    </div>
  );
}

function MonetizationCard({ entry }: { entry: MonetizationHintEntry }) {
  return (
    <Link href={`/research/market/${entry.date}`} className="block">
      <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">💰</span>
            <span className="text-xs font-medium text-gray-500">収益化ヒント</span>
          </div>
          <span className="text-xs text-gray-400 font-mono">{entry.date}</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
          {entry.items.slice(0, 5).map((it, idx) => (
            <li key={idx} className="leading-relaxed break-words">
              {it}
            </li>
          ))}
        </ul>
        {entry.items.length > 5 && (
          <p className="text-xs text-gray-400 mt-2">
            他 {entry.items.length - 5} 件… (タップで全文)
          </p>
        )}
      </article>
    </Link>
  );
}

async function UtilizationListServer() {
  const entries = await aggregateUtilization();
  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400">
        <p className="text-4xl mb-3">🧭</p>
        <p className="text-sm">活用レビュー欄が記入された日次レポートはまだありません。</p>
        <p className="text-xs mt-2 text-gray-500 leading-relaxed">
          各 daily ファイルに「## 活用レビュー」セクションが追記されると、ここに集約されます。
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <UtilizationItemCard key={`${e.sourceCategory}-${e.date}`} entry={e} />
      ))}
    </div>
  );
}

function UtilizationItemCard({ entry }: { entry: UtilizationEntry }) {
  const detailHref =
    entry.sourceCategory === "papers" ||
    entry.sourceCategory === "method" ||
    entry.sourceCategory === "market" ||
    entry.sourceCategory === "news" ||
    entry.sourceCategory === "tools"
      ? `/research/${entry.sourceCategory}/${entry.date}`
      : "#";
  return (
    <Link href={detailHref} className="block">
      <article className="bg-emerald-50/60 rounded-2xl border border-emerald-100 p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-emerald-800">
            🧭 {CATEGORY_META[entry.sourceCategory].label}
          </span>
          <span className="text-xs text-gray-400 font-mono">{entry.date}</span>
        </div>
        <p className="text-sm font-semibold text-gray-900 line-clamp-1">
          {entry.sourceTitle}
        </p>
        {entry.utilization.useCase && (
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
            🎯 {entry.utilization.useCase}
          </p>
        )}
      </article>
    </Link>
  );
}

async function PapersListServer() {
  const docs = await listResearchDocs("papers");
  const watchlist = await readPaperWatchlist();

  if (docs.length === 0 && !watchlist) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400">
        <p className="text-4xl mb-3">📄</p>
        <p className="text-sm">論文情報はまだありません。</p>
        <p className="text-xs mt-2 text-gray-500 leading-relaxed">
          想定保存先: <code className="px-1 bg-slate-100 rounded text-[10px]">06_research/daily-ai-papers/</code>
          {" / "}
          <code className="px-1 bg-slate-100 rounded text-[10px]">06_research/paper-watchlist.md</code>
        </p>
      </div>
    );
  }

  return (
    <>
      {watchlist && (
        <section className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-900 mb-2">論文ウォッチリスト</h3>
          <MarkdownView markdown={watchlist} />
        </section>
      )}
      {docs.length > 0 ? <ResearchClientList docs={docs} /> : null}
    </>
  );
}

function EmptyDocsState() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center text-gray-400">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-sm">該当する Markdown はまだ生成されていません。</p>
      <p className="text-xs mt-2 text-gray-500 leading-relaxed">
        Hermes/Codex の市場調査ジョブが次回実行されると追加されます。
      </p>
    </div>
  );
}
