import { PaperInfo, Priority } from "@/lib/research/types";

interface Props {
  paper: PaperInfo;
  date?: string;
  /** Markdown 側に未記入欄を「未記入」として見せる（scaffold 用） */
  showEmpty?: boolean;
}

const ROWS: Array<{ key: keyof PaperInfo; label: string; emoji: string }> = [
  { key: "title", label: "論文タイトル", emoji: "📑" },
  { key: "url", label: "URL", emoji: "🔗" },
  { key: "org", label: "発表元", emoji: "🏛️" },
  { key: "novelty", label: "何が新しいか", emoji: "✨" },
  { key: "indieImpact", label: "個人開発への影響", emoji: "👤" },
  { key: "factoryImpact", label: "AI開発工場への影響", emoji: "🏭" },
  { key: "applicability", label: "既存アプリへの応用候補", emoji: "🔁" },
  { key: "monetizationRelation", label: "収益化との関係", emoji: "💰" },
  { key: "implementationIdea", label: "実装に使えそうなアイデア", emoji: "🧪" },
];

export function PaperInfoCard({ paper, date, showEmpty = true }: Props) {
  return (
    <section className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">📄</span>
          <h3 className="text-sm font-bold text-pink-900">注目の論文情報</h3>
          {paper.priority && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priorityClass(paper.priority)}`}>
              {paper.priority}
            </span>
          )}
        </div>
        {date && (
          <span className="text-xs text-gray-400 font-mono">{date}</span>
        )}
      </div>
      <dl className="space-y-3">
        {ROWS.map(({ key, label, emoji }) => {
          const value = paper[key];
          if (!value && !showEmpty) return null;
          return (
            <div key={key}>
              <dt className="text-xs font-medium text-pink-800 flex items-center gap-1">
                <span>{emoji}</span>
                <span>{label}</span>
              </dt>
              <dd className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                {value && String(value).trim() ? (
                  key === "url" ? (
                    <a
                      href={String(value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline break-all"
                    >
                      {String(value)}
                    </a>
                  ) : (
                    String(value)
                  )
                ) : (
                  <span className="text-gray-400">未記入</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
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
