// ========================================
// 牌・手牌の表示コンポーネント
// ========================================
// 将来、画像牌に差し替える場合はここを変更するだけでよい
// ========================================

import React from "react";
import { Tile } from "@/lib/mahjong/types";
import { tileToString } from "@/lib/mahjong/tiles";

// スーツごとの文字色クラス
const SUIT_COLOR: Record<string, string> = {
  m: "text-red-600",
  p: "text-blue-600",
  s: "text-green-700",
  z: "text-purple-700",
};

// スーツごとの背景色クラス (ハイライト用)
const SUIT_BG: Record<string, string> = {
  m: "bg-red-50 border-red-300",
  p: "bg-blue-50 border-blue-300",
  s: "bg-green-50 border-green-300",
  z: "bg-purple-50 border-purple-300",
};

type TileSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<TileSize, string> = {
  xs: "text-xs px-1 py-0.5 min-w-[1.4rem] text-center",
  sm: "text-sm px-1.5 py-0.5 min-w-[1.8rem] text-center",
  md: "text-base px-2 py-1 min-w-[2.2rem] text-center",
  lg: "text-lg px-2.5 py-1.5 min-w-[2.8rem] text-center",
};

interface TileProps {
  tile: Tile;
  size?: TileSize;
  /** ハイライト表示 (有効牌などを示すとき) */
  highlight?: boolean;
  /** 選択中 (切る牌の強調表示) */
  selected?: boolean;
}

/**
 * 1枚の牌を表示するコンポーネント
 * テキスト表示版 — 将来は画像に差し替えやすい構造
 */
export function TileDisplay({
  tile,
  size = "md",
  highlight = false,
  selected = false,
}: TileProps) {
  const color = SUIT_COLOR[tile.suit];
  const sizeClass = SIZE_CLASS[size];

  let containerClass =
    `inline-flex items-center justify-center rounded border font-mono font-bold ` +
    `${sizeClass} ${color} `;

  if (selected) {
    containerClass += "bg-yellow-200 border-yellow-500 ring-2 ring-yellow-400 ";
  } else if (highlight) {
    containerClass += `${SUIT_BG[tile.suit]} `;
  } else {
    containerClass += "bg-white border-gray-300 ";
  }

  return (
    <span className={containerClass.trim()} title={tileToString(tile)}>
      {tileToString(tile)}
    </span>
  );
}

interface HandDisplayProps {
  tiles: Tile[];
  /** ハイライトする牌セット */
  highlightTiles?: Tile[];
  /** 選択する牌 (切る牌として強調) */
  selectedTile?: Tile | null;
  size?: TileSize;
}

/**
 * 複数枚の牌を横並びに表示するコンポーネント
 */
export function HandDisplay({
  tiles,
  highlightTiles = [],
  selectedTile = null,
  size = "md",
}: HandDisplayProps) {
  const highlightSet = new Set(
    highlightTiles.map((t) => `${t.number}${t.suit}`)
  );
  const selectedKey = selectedTile
    ? `${selectedTile.number}${selectedTile.suit}`
    : null;

  return (
    <div className="flex flex-wrap gap-1">
      {tiles.map((tile, i) => {
        const key = `${tile.number}${tile.suit}`;
        return (
          <TileDisplay
            key={i}
            tile={tile}
            size={size}
            highlight={highlightSet.has(key)}
            selected={selectedKey === key}
          />
        );
      })}
    </div>
  );
}
