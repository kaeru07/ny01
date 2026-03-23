// ========================================
// 手牌入力フォームコンポーネント
// ========================================
// テキスト入力 (例: 123m456p789s12m11z)
// 将来: 牌ボタンUIに差し替えやすいよう、
//       入力値は文字列のままで渡す設計にしている
// ========================================

"use client";

import React, { useState } from "react";
import { parseHand } from "@/lib/mahjong/parser";
import { Tile } from "@/lib/mahjong/types";

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
}

/**
 * 手牌入力フォーム
 *
 * - テキストフィールドに入力形式で手牌を入力
 * - 「解析」ボタンを押すと onAnalyze が呼ばれる
 * - 入力ミス時はフォーム内にエラーを表示
 */
export function HandInput({ onAnalyze }: HandInputProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = parseHand(input);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError(null);
    onAnalyze(result.tiles);
  }

  function handleExample(value: string) {
    setInput(value);
    setError(null);
    // 即解析
    const result = parseHand(value);
    if (result.success) onAnalyze(result.tiles);
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
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="123m456p789s12m11z"
          className={`flex-1 rounded-lg border px-3 py-2 text-base font-mono
            focus:outline-none focus:ring-2 focus:ring-blue-400
            ${error ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800
            text-white font-semibold px-5 py-2 transition-colors"
        >
          解析
        </button>
      </form>

      {/* エラー表示 */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
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
              onClick={() => handleExample(ex.value)}
              className="text-xs rounded-full border border-gray-300 hover:border-blue-400
                hover:text-blue-600 px-3 py-1 transition-colors bg-gray-50 hover:bg-blue-50"
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
