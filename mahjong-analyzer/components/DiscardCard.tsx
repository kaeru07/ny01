// ========================================
// 打牌候補 1件を表示するカードコンポーネント
// ========================================

import React from "react";
import { DiscardCandidate } from "@/lib/mahjong/types";
import { TileDisplay, HandDisplay } from "./TileDisplay";

const RANK_BADGE: Record<number, { bg: string; text: string; label: string }> =
  {
    0: { bg: "bg-yellow-400", text: "text-yellow-900", label: "第1候補" },
    1: { bg: "bg-gray-300",   text: "text-gray-700",   label: "第2候補" },
    2: { bg: "bg-orange-300", text: "text-orange-800",  label: "第3候補" },
  };

/** シャンテン数の表示テキスト */
function shantenLabel(n: number): { text: string; color: string } {
  if (n === -1) return { text: "和了！",       color: "text-purple-600 font-bold" };
  if (n === 0)  return { text: "テンパイ",     color: "text-green-600 font-bold" };
  if (n === 1)  return { text: "一向聴",       color: "text-blue-600 font-semibold" };
  if (n === 2)  return { text: "二向聴",       color: "text-orange-500" };
  return         { text: `${n}向聴`,           color: "text-gray-500" };
}

/** ラベルのスタイル */
function labelStyle(label: string): string {
  if (label === "即テンパイ")    return "bg-green-100 text-green-700 border border-green-300";
  if (label === "受け入れ広い")  return "bg-blue-100 text-blue-700 border border-blue-300";
  if (label === "孤立牌")        return "bg-gray-100 text-gray-600 border border-gray-300";
  if (label === "安全牌候補")    return "bg-purple-100 text-purple-700 border border-purple-300";
  return "bg-gray-100 text-gray-600 border border-gray-200";
}

interface DiscardCardProps {
  candidate: DiscardCandidate;
  rank: number;
}

/**
 * 打牌候補1件を表示するカード
 */
export function DiscardCard({ candidate, rank }: DiscardCardProps) {
  const badge = RANK_BADGE[rank] ?? RANK_BADGE[2];
  const { text: shantenText, color: shantenColor } = shantenLabel(
    candidate.resultShanten
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        {/* 順位バッジ */}
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>

        {/* 切る牌 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">切り牌</span>
          <TileDisplay tile={candidate.tile} size="lg" selected />
        </div>

        {/* シャンテン数 */}
        <span className={`ml-auto text-sm ${shantenColor}`}>{shantenText}</span>
      </div>

      {/* ラベル */}
      {candidate.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {candidate.labels.map((label) => (
            <span
              key={label}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${labelStyle(label)}`}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* 理由 */}
      <p className="px-4 pt-2 pb-3 text-sm text-gray-700 leading-relaxed">
        {candidate.reason}
      </p>

      {/* 有効牌 */}
      {candidate.effectiveTiles.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-500 mb-1.5">
            有効牌 ({candidate.effectiveTileCount}枚)
          </div>
          <HandDisplay
            tiles={candidate.effectiveTiles}
            highlightTiles={candidate.effectiveTiles}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
