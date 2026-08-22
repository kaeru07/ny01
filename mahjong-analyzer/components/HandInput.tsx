// ========================================
// 手牌入力フォームコンポーネント
// ========================================
// テキスト入力 (例: 123m456p789s12m11z)
// 将来: 牌ボタンUIに差し替えやすいよう、
//       入力値は文字列のままで渡す設計にしている
// ========================================

"use client";

import React, { useEffect, useRef, useState } from "react";
import { parseHand } from "@/lib/mahjong/parser";
import { Tile } from "@/lib/mahjong/types";
import {
  loadHandDraft,
  MAX_HAND_INPUT_LENGTH,
  saveHandDraft,
} from "@/lib/mahjong/handDraft";

/** サンプル手牌 */
const EXAMPLES = [
  {
    label: "一向聴 (14枚)",
    value: "123m456p789s12m11z5p",
    desc: "1234m456p789s11z + 5p",
  },
  {
    label: "テンパイ (14枚)",
    value: "123456789m11z22z3z",
    desc: "123m456m789m 11z22z + 3z",
  },
  {
    label: "七対子狙い (13枚)",
    value: "1122m3344p5566s1z",
    desc: "6対子 → 一向聴",
  },
  {
    label: "配牌風 (13枚)",
    value: "19m19p19s1234567z",
    desc: "国士狙い",
  },
];

interface HandInputProps {
  onAnalyze: (tiles: Tile[]) => void;
  onInvalid: () => void;
  onInputChange: () => void;
  isAnalyzing?: boolean;
}

/** WebView の設定によって localStorage の取得自体が失敗しても解析を続ける。 */
function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 手牌入力フォーム
 *
 * - テキストフィールドに入力形式で手牌を入力
 * - 「解析」ボタンを押すと onAnalyze が呼ばれる
 * - 入力ミス時はフォーム内にエラーを表示
 */
export function HandInput({
  onAnalyze,
  onInvalid,
  onInputChange,
  isAnalyzing = false,
}: HandInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const onAnalyzeRef = useRef(onAnalyze);
  const inputTileCount = (input.normalize("NFKC").match(/[0-9]/g) ?? []).length;
  const hasAnalyzableTileCount = inputTileCount === 13 || inputTileCount === 14;
  const isValidHand = hasAnalyzableTileCount && parseHand(input).success;
  const isSubmitDisabled = isAnalyzing || !isValidHand;
  const submitLabel = isAnalyzing
    ? "解析中…"
    : input.length > 0 && !isValidHand
      ? "入力を確認"
      : "解析";

  onAnalyzeRef.current = onAnalyze;

  useEffect(() => {
    const draft = loadHandDraft(getLocalStorage());
    setInput(draft);

    // 完成した手牌を復元した場合は、前回の続きをすぐ確認できるよう再解析する。
    // 入力途中や旧版の不正な保存値はフォームへ戻すだけにし、エラー表示は出さない。
    const restoredHand = parseHand(draft);
    if (restoredHand.success) {
      onAnalyzeRef.current(restoredHand.tiles);
    }
  }, []);

  function updateInput(value: string) {
    setInput(value);
    const saved = saveHandDraft(getLocalStorage(), value);
    // 空入力には保存すべき下書きがないため、クリア後まで保存不可の
    // 警告を残さない。次に文字を入力した時点で保存可否を再判定する。
    setStorageWarning(value.trim().length > 0 && !saved);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = parseHand(input);
    if (!result.success) {
      setError(result.error);
      onInvalid();
      return;
    }
    setError(null);
    onAnalyze(result.tiles);
  }

  function handleExample(value: string) {
    updateInput(value);
    setError(null);
    // 即解析
    const result = parseHand(value);
    if (result.success) onAnalyze(result.tiles);
  }

  function handleClear() {
    updateInput("");
    setError(null);
    onInvalid();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-4">
      {/* タイトル */}
      <div>
        <h2 className="font-semibold text-gray-800">手牌を入力</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          例:{" "}
          <code className="bg-gray-100 rounded px-1">123m456p789s12m11z</code>
          　m=万子 / p=筒子 / s=索子 / z=字牌(1東2南3西4北5白6発7中)
        </p>
      </div>

      {/* 入力フォーム */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="hand-input" className="sr-only">
          解析する13枚または14枚の手牌
        </label>
        <input
          id="hand-input"
          type="text"
          value={input}
          onChange={(e) => {
            updateInput(e.target.value);
            setError(null);
            onInputChange();
          }}
          placeholder="123m456p789s12m11z"
          className={`flex-1 rounded-lg border px-3 py-2 text-base font-mono
            focus:outline-none focus:ring-2 focus:ring-blue-400
            ${error ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          enterKeyHint="done"
          maxLength={MAX_HAND_INPUT_LENGTH}
          spellCheck={false}
          aria-invalid={error !== null}
          aria-describedby={
            error ? "hand-input-help hand-input-error" : "hand-input-help"
          }
          disabled={isAnalyzing}
        />
        {input.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-600 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:bg-gray-100"
            aria-label="入力した手牌と解析結果をクリア"
            disabled={isAnalyzing}
          >
            クリア
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          aria-describedby="hand-input-status"
          className="min-h-11 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400
            text-white font-semibold px-5 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          {submitLabel}
        </button>
      </form>

      <p id="hand-input-help" className="text-xs leading-relaxed text-gray-500">
        数字の後に種類（m=萬子、p=筒子、s=索子、z=字牌）を入力します。
        赤5は0で入力できます。例: 123m456p789s11z12m
      </p>

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-gray-500">
        <span aria-hidden="true">🔒</span>
        <span>
          入力した手牌はこの端末内にのみ保存され、外部には送信されません。
        </span>
      </p>

      {storageWarning && (
        <p
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800"
        >
          この端末では手牌を保存できません。解析はそのまま利用できますが、アプリを閉じると入力内容は失われます。
        </p>
      )}

      <p
        id="hand-input-status"
        role="status"
        aria-live="polite"
        className={`text-xs font-medium ${
          inputTileCount === 0
            ? "text-gray-500"
            : isValidHand
              ? "text-green-700"
              : "text-amber-700"
        }`}
      >
        {inputTileCount === 0
          ? "入力枚数: 0枚（13枚または14枚を入力）"
          : isValidHand
            ? `入力枚数: ${inputTileCount}枚（解析できます）`
            : hasAnalyzableTileCount
              ? `入力枚数: ${inputTileCount}枚（入力形式を確認してください）`
            : `入力枚数: ${inputTileCount}枚（13枚または14枚にしてください）`}
      </p>

      {/* エラー表示 */}
      {error && (
        <div
          id="hand-input-error"
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
        >
          ⚠ {error}
        </div>
      )}

      {/* サンプル手牌 */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">サンプルで試す:</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.value}
              type="button"
              onClick={() => handleExample(ex.value)}
              disabled={isAnalyzing}
              className="min-h-11 text-xs rounded-full border border-gray-300 hover:border-blue-400
                hover:text-blue-600 px-4 py-2 transition-colors bg-gray-50 hover:bg-blue-50
                focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              title={ex.desc}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* 入力形式の説明 */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700 select-none">
          入力形式の詳細
        </summary>
        <div className="mt-2 space-y-1 pl-2">
          <p>• 数字の後にスーツ文字を付ける: <code className="bg-gray-100 rounded px-1">123m</code> = 1万2万3万</p>
          <p>• 複数のスーツを続けて書ける: <code className="bg-gray-100 rounded px-1">123m456p789s</code></p>
          <p>• 字牌: <code className="bg-gray-100 rounded px-1">1z</code>=東 <code className="bg-gray-100 rounded px-1">2z</code>=南 <code className="bg-gray-100 rounded px-1">3z</code>=西 <code className="bg-gray-100 rounded px-1">4z</code>=北 <code className="bg-gray-100 rounded px-1">5z</code>=白 <code className="bg-gray-100 rounded px-1">6z</code>=発 <code className="bg-gray-100 rounded px-1">7z</code>=中</p>
          <p>• 13枚 or 14枚を入力 (14枚で打牌候補を表示)</p>
          <p>• 赤ドラは <code className="bg-gray-100 rounded px-1">0m</code> / <code className="bg-gray-100 rounded px-1">0p</code> / <code className="bg-gray-100 rounded px-1">0s</code> (5として扱います)</p>
        </div>
      </details>
    </div>
  );
}
