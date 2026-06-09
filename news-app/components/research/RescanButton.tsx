"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * 市場調査ビューの手動更新ボタン。
 * /api/research/rescan を叩いて /research のキャッシュを revalidate し、
 * router.refresh() で再スキャン結果を反映する。
 */
export function RescanButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [doneAt, setDoneAt] = useState<string | null>(null);

  async function handleRescan() {
    setDoneAt(null);
    try {
      await fetch("/api/research/rescan", { method: "POST" });
    } catch {
      // ネットワークエラーでも refresh は試みる
    }
    startTransition(() => router.refresh());
    setDoneAt(new Date().toLocaleTimeString("ja-JP"));
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleRescan}
        disabled={pending}
        className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2.5 py-1 active:bg-sky-100 disabled:opacity-50"
      >
        {pending ? "更新中…" : "🔄 再スキャン"}
      </button>
      {doneAt && !pending && (
        <span className="text-[10px] text-gray-400">更新: {doneAt}</span>
      )}
    </div>
  );
}
