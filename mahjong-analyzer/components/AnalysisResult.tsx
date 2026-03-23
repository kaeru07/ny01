// ========================================
// 解析結果全体を表示するコンポーネント
// ========================================

import React from "react";
import { AnalysisResult } from "@/lib/mahjong/types";
import { HandDisplay } from "./TileDisplay";
import { DiscardCard } from "./DiscardCard";

/** シャンテン数に応じたバッジスタイル */
function shantenBadge(n: number): {
  label: string;
  bg: string;
  text: string;
} {
  if (n === -1) return { label: "和了！",     bg: "bg-purple-600", text: "text-white" };
  if (n === 0)  return { label: "テンパイ",   bg: "bg-green-500",  text: "text-white" };
  if (n === 1)  return { label: "一向聴",     bg: "bg-blue-500",   text: "text-white" };
  if (n === 2)  return { label: "二向聴",     bg: "bg-orange-400", text: "text-white" };
  return         { label: `${n}向聴`,         bg: "bg-gray-400",   text: "text-white" };
}

interface Props {
  result: AnalysisResult;
}

/**
 * 解析結果コンポーネント
 *
 * 13枚: シャンテン数 + 有効牌
 * 14枚: シャンテン数 + 打牌候補3件
 */
export function AnalysisResultView({ result }: Props) {
  const badge = shantenBadge(result.shanten);
  const is13 = result.tileCount === 13;

  return (
    <div className="space-y-6">
      {/* ── 手牌表示 ── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
          現在の手牌
        </h2>
        <HandDisplay
          tiles={result.hand}
          selectedTile={
            result.discardCandidates[0]?.tile ?? null
          }
          size="lg"
        />
      </section>

      {/* ── シャンテン数 ── */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
          シャンテン数
        </h2>
        <div className="flex items-center gap-3">
          <span
            className={`text-2xl font-bold px-4 py-1.5 rounded-lg ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
          {result.shanten >= 0 && (
            <span className="text-sm text-gray-500">
              {is13 ? "ツモ有効牌" : "最良打牌後の有効牌"}:{" "}
              <span className="font-semibold text-gray-700">
                {result.effectiveTileCount}枚
              </span>
            </span>
          )}
        </div>
      </section>

      {/* ── 13枚: 有効牌 ── */}
      {is13 && result.effectiveTiles.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            有効牌 (ツモると前進する牌)
          </h2>
          <HandDisplay
            tiles={result.effectiveTiles}
            highlightTiles={result.effectiveTiles}
            size="md"
          />
        </section>
      )}

      {/* ── 13枚: テンパイ待ち ── */}
      {is13 && result.shanten === 0 && result.effectiveTiles.length > 0 && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          ✓ テンパイ中です。上記の牌をツモると和了できます。
        </div>
      )}

      {/* ── 14枚: 打牌候補 ── */}
      {!is13 && result.discardCandidates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            おすすめ打牌 (上位3候補)
          </h2>
          <div className="space-y-3">
            {result.discardCandidates.map((cand, i) => (
              <DiscardCard key={i} candidate={cand} rank={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
