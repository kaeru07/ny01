// ========================================
// 解析結果全体を表示するコンポーネント
// ========================================

import React from "react";
import { AnalysisResult } from "@/lib/mahjong/types";
import { HandDisplay, TileDisplay } from "./TileDisplay";
import { DiscardCard } from "./DiscardCard";
import { countRemainingTile } from "@/lib/mahjong/analyzer";
import { tileAccessibleName } from "@/lib/mahjong/tiles";

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
 * 14枚: シャンテン数 + 異なる牌ごとの全打牌候補
 */
export function AnalysisResultView({ result }: Props) {
  const badge = shantenBadge(result.shanten);
  const is13 = result.tileCount === 13;
  const bestDiscard = result.discardCandidates[0]?.tile;

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
              {is13 ? (
                "ツモ有効牌"
              ) : bestDiscard ? (
                <>
                  第1候補の
                  <span className="font-semibold text-gray-700">
                    {tileAccessibleName(bestDiscard)}
                  </span>
                  を切った後の有効牌
                </>
              ) : (
                "最良打牌後の有効牌"
              )}
              :{" "}
              <span className="font-semibold text-gray-700">
                {result.effectiveTileCount}枚
              </span>
            </span>
          )}
        </div>
      </section>

      {/* 河・副露を入力しない MVP では、受け入れ枚数は理論上限として案内する。 */}
      {result.shanten >= 0 && (
        <aside className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900">
          <span className="font-semibold">受け入れ枚数について:</span>{" "}
          手牌で見えている牌だけを差し引いた理論上の最大枚数です。河や他家の副露で見えている牌は含まれないため、実戦の残り枚数は少ない場合があります。
        </aside>
      )}

      {/* ── 14枚: 和了形 ── */}
      {!is13 && result.shanten === -1 && (
        <section
          role="status"
          className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900"
        >
          <h2 className="font-semibold">和了形です</h2>
          <p className="mt-1">
            手牌が完成しています。打牌候補を確認する必要はありません。
          </p>
        </section>
      )}

      {/* ── 13枚: 有効牌 ── */}
      {is13 && result.effectiveTiles.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            有効牌 (ツモると前進する牌)
          </h2>
          <div className="flex flex-wrap gap-2">
            {result.effectiveTiles.map((tile) => {
              const remaining = countRemainingTile(tile, result.hand);
              return (
                <div
                  key={`${tile.suit}-${tile.number}`}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5"
                  aria-label={`${tileAccessibleName(tile)} 残り${remaining}枚`}
                >
                  <TileDisplay tile={tile} size="md" highlight />
                  <span className="text-xs font-semibold text-blue-800">
                    残り{remaining}枚
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 13枚: 有効牌なし ── */}
      {is13 && result.effectiveTiles.length === 0 && (
        <section
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <h2 className="font-semibold">有効牌が見つかりませんでした</h2>
          <p className="mt-1">
            現在の手牌では、ツモによってシャンテン数が下がる牌はありません。入力内容を確認してください。
          </p>
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
            打牌候補 (全{result.discardCandidates.length}件)
          </h2>
          <div className="space-y-3">
            {result.discardCandidates.map((cand, i) => (
              <DiscardCard
                key={`${cand.tile.suit}-${cand.tile.number}`}
                candidate={cand}
                rank={i}
                visibleTiles={result.hand}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
