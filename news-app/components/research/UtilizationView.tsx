import { UtilizationReview } from "@/lib/research/types";

interface Props {
  utilization?: UtilizationReview;
  /** Markdown 側に欄が無い場合に "未記入" を見せる */
  showEmpty?: boolean;
}

const ROWS: Array<{ key: keyof UtilizationReview; label: string; emoji: string }> = [
  { key: "useCase", label: "この情報の使い道", emoji: "🎯" },
  { key: "monetization", label: "収益化への使い方", emoji: "💰" },
  { key: "applyToExisting", label: "既存アプリ/プロジェクトへの反映候補", emoji: "🔁" },
  { key: "newAppIdea", label: "新規アプリ案につながる可能性", emoji: "🚀" },
  { key: "snsRepurpose", label: "SNS・Shorts・記事ネタへの転用", emoji: "📣" },
  { key: "doNow", label: "すぐやる価値", emoji: "⚡" },
  { key: "deferReason", label: "まだ保留でよい理由", emoji: "🕰️" },
  { key: "nextCheck", label: "次に確認すること", emoji: "🔍" },
];

export function UtilizationView({ utilization, showEmpty = true }: Props) {
  if (!utilization && !showEmpty) return null;
  return (
    <section className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🧭</span>
        <h3 className="text-sm font-bold text-emerald-900">活用レビュー</h3>
      </div>
      <dl className="space-y-3">
        {ROWS.map(({ key, label, emoji }) => {
          const value = utilization?.[key];
          return (
            <div key={key}>
              <dt className="text-xs font-medium text-emerald-800 flex items-center gap-1">
                <span>{emoji}</span>
                <span>{label}</span>
              </dt>
              <dd className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                {value && value.trim() ? value : (
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
