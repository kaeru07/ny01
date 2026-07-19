import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  ResearchCategory,
} from "@/lib/research/types";
import { getResearchDoc } from "@/lib/research/vault";
import { MarkdownView } from "@/components/research/MarkdownView";
import { UtilizationView } from "@/components/research/UtilizationView";
import { PaperInfoCard } from "@/components/research/PaperInfoCard";
import { StructuredResearchView } from "@/components/research/StructuredResearchView";

export const revalidate = 60;

interface Props {
  params: { category: string; date: string };
}

const DETAIL_CATEGORIES: ResearchCategory[] = [
  "market",
  "news",
  "tools",
  "method",
  "papers",
];

function isDetailCategory(value: string): value is ResearchCategory {
  return (
    (CATEGORY_ORDER as readonly string[]).includes(value) &&
    DETAIL_CATEGORIES.includes(value as ResearchCategory)
  );
}

export default async function ResearchDetailPage({ params }: Props) {
  const { category, date } = params;
  if (!isDetailCategory(category)) notFound();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const doc = await getResearchDoc(category, date);
  if (!doc) notFound();

  const meta = CATEGORY_META[category];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href={`/research/${category}`}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
          >
            ←
          </Link>
          <span className="text-base">{meta.emoji}</span>
          <span className="text-sm font-semibold text-gray-900 truncate">
            {meta.label} / {doc.date}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-xs text-gray-400 font-mono">{doc.date}</span>
            <span className="text-xs text-gray-500">{meta.label}</span>
            {doc.priority && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
                重要度 {doc.priority}
              </span>
            )}
            {doc.partial && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                partial
              </span>
            )}
            {doc.hasError && (
              <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                error
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 font-mono break-all">
            原本: 06_research/{doc.relativePath}
          </p>
        </article>

        {doc.paperInfo && (
          <PaperInfoCard paper={doc.paperInfo} date={doc.date} />
        )}

        {category === "papers" && !doc.paperInfo && (
          <PaperInfoCard paper={{}} date={doc.date} showEmpty />
        )}

        <UtilizationView utilization={doc.utilization} showEmpty={true} />

        {doc.structured ? (
          <>
            <StructuredResearchView data={doc.structured} docDate={doc.date} />
            <details className="bg-white rounded-2xl border border-gray-100 p-4">
              <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
                原文 Markdown を表示
              </summary>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <MarkdownView markdown={doc.raw} />
              </div>
            </details>
          </>
        ) : (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <MarkdownView markdown={doc.raw} />
          </section>
        )}

        {doc.sections.length > 0 && (
          <details className="bg-white rounded-2xl border border-gray-100 p-4">
            <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
              セクション一覧（{doc.sections.length}）
            </summary>
            <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
              {doc.sections.map((s, idx) => (
                <li key={idx} className="leading-relaxed">
                  ## {s.heading}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>

      <div className="h-8" />
    </div>
  );
}
