"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ObservationForm from "@/components/ObservationForm";
import { useObservations } from "@/components/useObservations";
import { birdEmoji, birdName, birdNameEn } from "@/lib/birds";
import { formatLocation } from "@/lib/location";
import type { Observation, ObservationInput } from "@/lib/types";

function ObservationsInner() {
  const { records, ready, create, update, remove } = useObservations();
  const params = useSearchParams();
  const [mode, setMode] = useState<"list" | "new" | { editId: string }>("list");

  useEffect(() => {
    if (params.get("new") === "1") setMode("new");
  }, [params]);

  const sorted = useMemo(
    () =>
      [...records].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0
      ),
    [records]
  );

  function handleCreate(input: ObservationInput) {
    create(input);
    setMode("list");
  }

  function handleUpdate(id: string, input: ObservationInput) {
    update(id, input);
    setMode("list");
  }

  if (mode === "new") {
    return (
      <Panel title="観察を記録">
        <ObservationForm
          onSubmit={handleCreate}
          onCancel={() => setMode("list")}
        />
      </Panel>
    );
  }

  if (typeof mode === "object") {
    const target = records.find((r) => r.id === mode.editId);
    if (!target) {
      setMode("list");
      return null;
    }
    return (
      <Panel title="観察を編集">
        <ObservationForm
          initial={target}
          onSubmit={(input) => handleUpdate(target.id, input)}
          onCancel={() => setMode("list")}
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-stone-700">
          観察記録{ready ? `（${records.length}）` : ""}
        </h2>
        <button
          onClick={() => setMode("new")}
          className="rounded-lg bg-forest px-3 py-1.5 text-sm font-semibold text-white hover:bg-canopy"
        >
          ＋ 記録
        </button>
      </div>

      {!ready ? (
        <p className="text-sm text-stone-400">読み込み中…</p>
      ) : sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          まだ記録がありません。「＋ 記録」から追加してください。
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((r) => (
            <ObservationRow
              key={r.id}
              record={r}
              onEdit={() => setMode({ editId: r.id })}
              onDelete={() => {
                if (confirm(`「${birdName(r.speciesId)}」の記録を削除しますか？`)) {
                  remove(r.id);
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ObservationRow({
  record,
  onEdit,
  onDelete,
}: {
  record: Observation;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-start gap-3">
        {record.photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={record.photoDataUrl}
            alt={birdName(record.speciesId)}
            className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100 text-2xl">
            {birdEmoji(record.speciesId)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-stone-800">
            {birdName(record.speciesId)}
            <span className="ml-2 text-xs font-normal text-stone-400">
              {birdNameEn(record.speciesId)}
            </span>
          </p>
          <p className="text-xs text-stone-500">
            {record.date}
            {record.time ? ` ${record.time}` : ""}
            {record.count && record.count > 1 ? ` ・ ${record.count}羽` : ""}
          </p>
          <p className="text-xs text-stone-500">📍 {formatLocation(record.location)}</p>
          {record.memo && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-stone-600">
              {record.memo}
            </p>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-3">
        <button
          onClick={onEdit}
          className="text-xs text-forest underline"
        >
          編集
        </button>
        <button onClick={onDelete} className="text-xs text-red-500 underline">
          削除
        </button>
      </div>
    </li>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-stone-700">{title}</h2>
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        {children}
      </div>
    </div>
  );
}

export default function ObservationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">読み込み中…</p>}>
      <ObservationsInner />
    </Suspense>
  );
}
