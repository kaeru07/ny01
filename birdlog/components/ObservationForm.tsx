"use client";

import { useState } from "react";
import SpeciesPicker from "./SpeciesPicker";
import { anonymizeLocation } from "@/lib/location";
import { fileToDownscaledDataUrl } from "@/lib/image";
import { getBird } from "@/lib/birds";
import type { Observation, ObservationInput } from "@/lib/types";

function todayStr(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

/**
 * 観察記録の作成 / 編集フォーム。
 * 種・日時・場所（匿名化）・写真・メモ・個体数を扱う。
 */
export default function ObservationForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Observation;
  onSubmit: (input: ObservationInput) => void;
  onCancel?: () => void;
}) {
  const [speciesId, setSpeciesId] = useState(initial?.speciesId ?? "");
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [time, setTime] = useState(initial?.time ?? "");
  const [count, setCount] = useState(String(initial?.count ?? 1));
  const [areaLabel, setAreaLabel] = useState(initial?.location?.areaLabel ?? "");
  const [lat, setLat] = useState(
    initial?.location?.coarseLat != null ? String(initial.location.coarseLat) : ""
  );
  const [lng, setLng] = useState(
    initial?.location?.coarseLng != null ? String(initial.location.coarseLng) : ""
  );
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [photoDataUrl, setPhotoDataUrl] = useState(initial?.photoDataUrl ?? "");
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      setPhotoDataUrl(await fileToDownscaledDataUrl(file));
    } catch {
      setError("写真の読み込みに失敗しました");
    } finally {
      setPhotoBusy(false);
    }
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("この端末では現在地を取得できません");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 粗い座標のみ保持（anonymizeLocation で 0.1 度に丸める）
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setGeoBusy(false);
      },
      () => {
        setError("現在地の取得に失敗しました");
        setGeoBusy(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!speciesId || !getBird(speciesId)) {
      setError("種を選択してください");
      return;
    }
    if (!date) {
      setError("観察日を入力してください");
      return;
    }
    const parsedCount = Math.max(1, Math.floor(Number(count) || 1));
    const location = anonymizeLocation({
      areaLabel,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    });

    const input: ObservationInput = {
      speciesId,
      date,
      time: time || undefined,
      count: parsedCount,
      memo: memo.trim() || undefined,
      photoDataUrl: photoDataUrl || undefined,
      location,
    };
    onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="種 *">
        <SpeciesPicker value={speciesId} onChange={setSpeciesId} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="観察日 *">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="時刻">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label="個体数">
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="場所（エリア名のみ・住所は記録しません）">
        <input
          type="text"
          value={areaLabel}
          onChange={(e) => setAreaLabel(e.target.value)}
          placeholder="例: ○○公園 / △△川"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={geoBusy}
            className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-200 disabled:opacity-50"
          >
            {geoBusy ? "取得中…" : "📍 現在地を粗く記録"}
          </button>
          {lat && lng && (
            <span className="text-[11px] text-stone-500">
              約 {Number(lat).toFixed(1)}, {Number(lng).toFixed(1)}（0.1度に丸め）
            </span>
          )}
          {(lat || lng) && (
            <button
              type="button"
              onClick={() => {
                setLat("");
                setLng("");
              }}
              className="text-[11px] text-stone-400 underline"
            >
              座標を消す
            </button>
          )}
        </div>
      </Field>

      <Field label="写真">
        <input
          type="file"
          accept="image/*"
          onChange={onPhotoChange}
          className="block w-full text-xs text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-xs"
        />
        {photoBusy && (
          <p className="mt-1 text-xs text-stone-500">写真を処理中…</p>
        )}
        {photoDataUrl && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoDataUrl}
              alt="観察写真プレビュー"
              className="h-20 w-20 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={() => setPhotoDataUrl("")}
              className="text-xs text-stone-400 underline"
            >
              写真を削除
            </button>
          </div>
        )}
      </Field>

      <Field label="メモ">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          placeholder="行動・羽色・鳴き声など"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={photoBusy}
          className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-canopy disabled:opacity-50"
        >
          {initial ? "更新する" : "記録する"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-stone-100 px-4 py-2 text-sm text-stone-700 hover:bg-stone-200"
          >
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-stone-600">
        {label}
      </span>
      {children}
    </label>
  );
}
