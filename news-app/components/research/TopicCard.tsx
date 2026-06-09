import React from "react";
import Link from "next/link";
import {
  AffectsProjects,
  ConfidenceLevel,
  Priority,
  ReferenceLink,
  ResearchTopic,
  SourceType,
} from "@/lib/research/types";
import { effectiveSourceDate, isStale } from "@/lib/research/summary";

interface Props {
  topic: ResearchTopic;
  /** 日次ファイルの日付。sourceDate fallback / stale 基準に使う。 */
  docDate: string;
  /** タイトルから単独 Topic ページへリンクする（既定 true）。 */
  permalink?: boolean;
  /** タグから tag 検索ページへリンクする（既定 true）。 */
  tagLinks?: boolean;
}

const MAX_VISIBLE = 3;
const MAX_REFS = 3;

export function TopicCard({
  topic,
  docDate,
  permalink = true,
  tagLinks = true,
}: Props) {
  const srcDate = effectiveSourceDate(topic, docDate);
  const stale = isStale(srcDate);
  const topicHref =
    permalink && topic.topicId
      ? `/research/topic/${encodeURIComponent(topic.topicId)}`
      : null;

  return (
    <article
      id={topic.topicId}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3.5 scroll-mt-20"
    >
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PriorityBadge priority={topic.importance} />
          <KindBadge kind={topic.kind} />
          {topic.confidence && <ConfidenceBadge confidence={topic.confidence} />}
          {topic.todoCandidate && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
              ToDo候補
            </span>
          )}
          {stale && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-yellow-100 text-yellow-800 border-yellow-300">
              情報が古い
            </span>
          )}
          {topicHref && (
            <Link
              href={topicHref}
              className="text-[11px] text-blue-500 ml-auto whitespace-nowrap"
            >
              単独表示 ↗
            </Link>
          )}
        </div>
        {topicHref ? (
          <Link href={topicHref} className="block">
            <h3 className="text-[17px] font-bold text-gray-900 leading-snug break-words active:text-blue-700">
              {topic.title}
            </h3>
          </Link>
        ) : (
          <h3 className="text-[17px] font-bold text-gray-900 leading-snug break-words">
            {topic.title}
          </h3>
        )}
      </div>

      {topic.summaryTlDr && (
        <p className="text-[15px] font-medium text-gray-800 leading-relaxed bg-slate-50 border-l-[3px] border-slate-300 rounded-r-lg px-3 py-2 break-words line-clamp-3">
          {topic.summaryTlDr}
        </p>
      )}

      <MetricsRow topic={topic} srcDate={srcDate} />

      {topic.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topic.tags.map((t, i) =>
            tagLinks ? (
              <Link
                key={i}
                href={`/research/tag/${encodeURIComponent(t)}`}
                className="text-[11px] text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5 break-all active:bg-sky-100"
              >
                #{t}
              </Link>
            ) : (
              <span
                key={i}
                className="text-[11px] text-sky-700 bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5 break-all"
              >
                #{t}
              </span>
            )
          )}
        </div>
      )}

      {topic.summary.length > 0 && (
        <BulletBlock items={topic.summary} textClass="text-[15px] text-gray-800" />
      )}

      {topic.monetizationImpact.length > 0 && (
        <Field label="収益化への示唆" accent="text-emerald-700">
          <BulletBlock
            items={topic.monetizationImpact}
            textClass="text-sm text-gray-700"
          />
        </Field>
      )}

      {topic.affectsProjects && (
        <Field label="既存PJへの影響" accent="text-violet-700">
          <AffectsProjectsView affects={topic.affectsProjects} />
        </Field>
      )}

      {topic.nextActions.length > 0 && (
        <Field label="次アクション" accent="text-blue-700">
          <BulletBlock items={topic.nextActions} textClass="text-sm text-gray-700" />
        </Field>
      )}

      {topic.references.length > 0 && (
        <Field label="参考URL" accent="text-gray-500">
          <ReferenceList refs={topic.references} />
        </Field>
      )}

      {(topic.duplicateKey || topic.similarityHints?.length) && (
        <div className="text-[11px] text-gray-400 space-y-0.5">
          {topic.duplicateKey && (
            <p className="break-all">重複キー: {topic.duplicateKey}</p>
          )}
          {topic.similarityHints && topic.similarityHints.length > 0 && (
            <p className="break-words">類似: {topic.similarityHints.join(" / ")}</p>
          )}
        </div>
      )}

      {topic.evidence.length > 0 && (
        <details className="group">
          <summary className="text-xs font-medium text-gray-400 cursor-pointer select-none list-none flex items-center gap-1">
            <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
            根拠を見る（{topic.evidence.length}）
          </summary>
          <ul className="mt-2 pl-4 space-y-1 border-l-2 border-gray-100">
            {topic.evidence.map((e, i) => (
              <li key={i} className="text-xs text-gray-500 leading-relaxed break-words">
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}

      {topic.updatedAt && (
        <p className="text-[10px] text-gray-300 font-mono">更新: {topic.updatedAt}</p>
      )}
    </article>
  );
}

function MetricsRow({
  topic,
  srcDate,
}: {
  topic: ResearchTopic;
  srcDate: string;
}) {
  const ev = topic.evidence.length;
  const refs = topic.references.length;
  if (ev === 0 && refs === 0 && !srcDate) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500">
      {ev > 0 && (
        <span className="bg-gray-100 rounded px-1.5 py-0.5">Evidence {ev}</span>
      )}
      {refs > 0 && (
        <span className="bg-gray-100 rounded px-1.5 py-0.5">Sources {refs}</span>
      )}
      {srcDate && (
        <span className="text-gray-400 font-mono">情報日付 {srcDate}</span>
      )}
    </div>
  );
}

function Field({
  label,
  accent,
  children,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={`text-[11px] font-semibold tracking-wide mb-1.5 ${accent}`}>
        {label}
      </p>
      {children}
    </div>
  );
}

/** 最大 MAX_VISIBLE 件まで表示し、超過分は折りたたむ。 */
function BulletBlock({
  items,
  textClass,
}: {
  items: string[];
  textClass: string;
}) {
  const visible = items.slice(0, MAX_VISIBLE);
  const rest = items.slice(MAX_VISIBLE);
  return (
    <>
      <ul className="space-y-1.5">
        {visible.map((it, i) => (
          <BulletItem key={i} text={it} textClass={textClass} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="mt-1.5">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">
            他 {rest.length} 件を表示
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {rest.map((it, i) => (
              <BulletItem key={i} text={it} textClass={textClass} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function BulletItem({ text, textClass }: { text: string; textClass: string }) {
  return (
    <li className={`leading-relaxed break-words flex gap-2 ${textClass}`}>
      <span className="text-gray-300 select-none">・</span>
      <span className="flex-1">{text}</span>
    </li>
  );
}

const PROJECT_LABELS: { key: keyof AffectsProjects; label: string }[] = [
  { key: "progress", label: "Progress" },
  { key: "newsApp", label: "News App" },
  { key: "mahjong", label: "Mahjong" },
  { key: "shogi", label: "Shogi" },
  { key: "scrapeLab", label: "Scrape Lab" },
  { key: "other", label: "その他" },
];

function AffectsProjectsView({ affects }: { affects: AffectsProjects }) {
  const rows = PROJECT_LABELS.filter((p) => (affects[p.key]?.length ?? 0) > 0);
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {rows.map((p) => (
        <li key={p.key} className="text-sm text-gray-700 flex gap-2 items-start">
          <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-100 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
            {p.label}
          </span>
          <span className="flex-1 leading-relaxed break-words line-clamp-2">
            {affects[p.key]!.join(" / ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReferenceList({ refs }: { refs: ReferenceLink[] }) {
  const visible = refs.slice(0, MAX_REFS);
  const rest = refs.slice(MAX_REFS);
  return (
    <>
      <ul className="space-y-1.5">
        {visible.map((r, i) => (
          <ReferenceItem key={i} link={r} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="mt-1.5">
          <summary className="text-xs text-gray-400 cursor-pointer select-none">
            他 {rest.length} 件
          </summary>
          <ul className="mt-1.5 space-y-1.5">
            {rest.map((r, i) => (
              <ReferenceItem key={i} link={r} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function ReferenceItem({ link }: { link: ReferenceLink }) {
  const display = link.label || link.url || "リンク";
  if (!link.url) {
    return (
      <li className="text-xs text-gray-500 break-words flex gap-1.5 items-center min-w-0">
        <SourceBadge sourceType={link.sourceType} />
        <span className="flex-1 truncate">{display}</span>
      </li>
    );
  }
  return (
    <li className="text-xs flex gap-1.5 items-center min-w-0">
      <SourceBadge sourceType={link.sourceType} />
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 text-blue-600 underline truncate"
        title={link.url}
      >
        {display}
      </a>
    </li>
  );
}

function SourceBadge({ sourceType }: { sourceType?: SourceType }) {
  if (!sourceType || sourceType === "other") {
    return <span className="text-gray-300 select-none">🔗</span>;
  }
  return (
    <span className="text-[10px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-1 py-0.5 whitespace-nowrap shrink-0">
      {sourceTypeLabel(sourceType)}
    </span>
  );
}

function sourceTypeLabel(s: SourceType): string {
  switch (s) {
    case "official":
      return "公式";
    case "reddit":
      return "Reddit";
    case "github":
      return "GitHub";
    case "ranking":
      return "ランキング";
    case "paper":
      return "論文";
    case "social":
      return "SNS";
    case "news":
      return "ニュース";
    default:
      return "他";
  }
}

function ConfidenceBadge({ confidence }: { confidence: ConfidenceLevel }) {
  const { label, cls } = confidenceStyle(confidence);
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      確度 {label}
    </span>
  );
}

function confidenceStyle(c: ConfidenceLevel): { label: string; cls: string } {
  switch (c) {
    // high = solid（確実）
    case "high":
      return { label: "高", cls: "bg-green-600 text-white border-green-600" };
    // medium = caution（要注意）
    case "medium":
      return { label: "中", cls: "bg-amber-50 text-amber-700 border-amber-300" };
    // low = speculative（推測）視認性を高くする
    case "low":
      return { label: "低 (推測)", cls: "bg-red-100 text-red-700 border-red-400" };
  }
}

function KindBadge({ kind }: { kind: string }) {
  const { label, cls } = kindStyle(kind);
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${priorityClass(priority)}`}
    >
      重要度 {priority}
    </span>
  );
}

function kindStyle(kind: string): { label: string; cls: string } {
  switch (kind) {
    case "市場":
      return { label: "市場", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
    case "競合":
      return { label: "競合", cls: "bg-purple-50 text-purple-700 border-purple-200" };
    case "ユーザー不満":
      return { label: "ユーザー不満", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "収益化":
      return { label: "収益化", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "技術":
      return { label: "技術", cls: "bg-sky-50 text-sky-700 border-sky-200" };
    case "ToDo候補":
      return { label: "ToDo候補", cls: "bg-rose-50 text-rose-700 border-rose-200" };
    case "general":
      return { label: "一般", cls: "bg-gray-50 text-gray-500 border-gray-200" };
    default:
      return { label: kind, cls: "bg-gray-50 text-gray-600 border-gray-200" };
  }
}

function priorityClass(p: Priority): string {
  switch (p) {
    case "S":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "A":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "B":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "C":
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}
