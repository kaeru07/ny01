// 収益化導線（広告 / サブスク）の UI プレースホルダ。
// MVP では実装せず、設計上の置き場所のみ用意する（local-first / 課金実装なし）。

export function AdSlot() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-center text-xs text-slate-400">
      広告枠（プレースホルダ）— 公開時に実装予定
    </div>
  );
}

export function SubscriptionCard() {
  return (
    <div className="rounded-xl border border-sea/30 bg-gradient-to-br from-sea/5 to-deep/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-deep">AnglerLog Pro（予定）</p>
          <p className="mt-1 text-xs text-slate-500">
            写真クラウド同期・無制限記録・高度な統計（サブスク導線プレースホルダ）
          </p>
        </div>
        <button
          type="button"
          disabled
          className="shrink-0 cursor-not-allowed rounded-lg bg-sea/40 px-3 py-2 text-xs font-medium text-white"
        >
          近日公開
        </button>
      </div>
    </div>
  );
}
