"use client";

import { useState } from "react";
import type { CatchRecord, Weather } from "@/lib/types";
import { WEATHER_LABELS } from "@/lib/types";
import { FISH_SPECIES } from "@/lib/fish-species";
import { anonymizeLocation } from "@/lib/location";
import { fileToDownscaledDataUrl } from "@/lib/image";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const WEATHERS = Object.keys(WEATHER_LABELS) as Weather[];

export function CatchForm({
  onAdd,
}: {
  onAdd: (record: Omit<CatchRecord, "id" | "createdAt">) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [speciesId, setSpeciesId] = useState(FISH_SPECIES[0].id);
  const [sizeCm, setSizeCm] = useState("");
  const [weightG, setWeightG] = useState("");
  const [weather, setWeather] = useState<Weather | "">("");
  const [rig, setRig] = useState("");
  const [memo, setMemo] = useState("");
  const [areaLabel, setAreaLabel] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const url = await fileToDownscaledDataUrl(file);
      setPhotoDataUrl(url);
    } finally {
      setPhotoBusy(false);
    }
  }

  function reset() {
    setSizeCm("");
    setWeightG("");
    setRig("");
    setMemo("");
    setAreaLabel("");
    setLat("");
    setLng("");
    setPhotoDataUrl(undefined);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const location = anonymizeLocation({
      areaLabel,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    });
    onAdd({
      date,
      speciesId,
      sizeCm: sizeCm ? Number(sizeCm) : undefined,
      weightG: weightG ? Number(weightG) : undefined,
      weather: weather || undefined,
      rig: rig.trim() || undefined,
      memo: memo.trim() || undefined,
      location,
      photoDataUrl,
    });
    reset();
  }

  const labelCls = "block text-xs font-medium text-slate-600 mb-1";
  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sea focus:ring-1 focus:ring-sea";

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="date">
            釣行日
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="species">
            魚種
          </label>
          <select
            id="species"
            value={speciesId}
            onChange={(e) => setSpeciesId(e.target.value)}
            className={inputCls}
          >
            {FISH_SPECIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="size">
            サイズ (cm)
          </label>
          <input
            id="size"
            type="number"
            inputMode="decimal"
            min="0"
            value={sizeCm}
            onChange={(e) => setSizeCm(e.target.value)}
            className={inputCls}
            placeholder="例: 28"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="weight">
            重量 (g)
          </label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            min="0"
            value={weightG}
            onChange={(e) => setWeightG(e.target.value)}
            className={inputCls}
            placeholder="例: 350"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="weather">
            天候
          </label>
          <select
            id="weather"
            value={weather}
            onChange={(e) => setWeather(e.target.value as Weather | "")}
            className={inputCls}
          >
            <option value="">未選択</option>
            {WEATHERS.map((w) => (
              <option key={w} value={w}>
                {WEATHER_LABELS[w]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="rig">
            仕掛け・タックル
          </label>
          <input
            id="rig"
            type="text"
            value={rig}
            onChange={(e) => setRig(e.target.value)}
            className={inputCls}
            placeholder="例: サビキ / ジグ 20g"
          />
        </div>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-500">
          場所（匿名化して保存）
        </legend>
        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="area">
              エリア名（釣り場・港など。番地は入力しない）
            </label>
            <input
              id="area"
              type="text"
              value={areaLabel}
              onChange={(e) => setAreaLabel(e.target.value)}
              className={inputCls}
              placeholder="例: 横浜・本牧"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="lat">
                緯度（任意）
              </label>
              <input
                id="lat"
                type="number"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className={inputCls}
                placeholder="35.43"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lng">
                経度（任意）
              </label>
              <input
                id="lng"
                type="number"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className={inputCls}
                placeholder="139.66"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            座標は約 11km 単位（小数第1位）に丸めて保存され、正確な地点は記録されません。
          </p>
        </div>
      </fieldset>

      <div>
        <label className={labelCls} htmlFor="photo">
          写真（端末内に保存）
        </label>
        <input
          id="photo"
          type="file"
          accept="image/*"
          onChange={handlePhoto}
          className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sea/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-deep"
        />
        {photoBusy && (
          <p className="mt-1 text-[11px] text-slate-400">画像を処理中…</p>
        )}
        {photoDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoDataUrl}
            alt="釣果プレビュー"
            className="mt-2 h-32 w-full rounded-lg object-cover"
          />
        )}
      </div>

      <div>
        <label className={labelCls} htmlFor="memo">
          メモ
        </label>
        <textarea
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className={inputCls}
          rows={2}
          placeholder="潮回り・時間帯・コンディションなど"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-sea px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deep"
      >
        釣果を記録する
      </button>
    </form>
  );
}
