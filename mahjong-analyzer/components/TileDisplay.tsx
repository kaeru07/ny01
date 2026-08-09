// ========================================
// 牌・手牌の表示コンポーネント
// ========================================
// public/tiles 配下の自作SVG牌を表示する
// ========================================

import React from "react";
import { Tile } from "@/lib/mahjong/types";
import { tileToString } from "@/lib/mahjong/tiles";

// SVGの読み込みに失敗した場合の文字色
const SUIT_COLOR: Record<Tile["suit"], string> = {
  m: "text-red-600",
  p: "text-blue-600",
  s: "text-green-700",
  z: "text-purple-700",
};

const SUIT_DIRECTORY: Record<Tile["suit"], string> = {
  m: "man",
  p: "pin",
  s: "sou",
  z: "honor",
};

const HONOR_FILENAME: Record<number, string> = {
  1: "east",
  2: "south",
  3: "west",
  4: "north",
  5: "white",
  6: "green",
  7: "red",
};

type TileSize = "xs" | "sm" | "md" | "lg";

const TILE_DIMENSIONS: Record<TileSize, { width: number; height: number }> = {
  xs: { width: 20, height: 28 },
  sm: { width: 24, height: 34 },
  md: { width: 32, height: 45 },
  lg: { width: 40, height: 56 },
};

function tileImageSrc(tile: Tile): string | null {
  if (tile.suit === "z") {
    const filename = HONOR_FILENAME[tile.number];
    return filename ? `/tiles/honor/${filename}.svg` : null;
  }

  // number=0 の旧形式が渡された場合も赤5として扱う。
  const filename = tile.isRed || tile.number === 0 ? "5-red" : String(tile.number);
  if (tile.number < 0 || tile.number > 9) return null;
  return `/tiles/${SUIT_DIRECTORY[tile.suit]}/${filename}.svg`;
}

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
 * SVG画像が取得できない場合は従来の文字表示へフォールバックする。
 */
export function TileDisplay({
  tile,
  size = "md",
  highlight = false,
  selected = false,
}: TileProps) {
  const label = tileToString(tile);
  const src = tileImageSrc(tile);
  const dimensions = TILE_DIMENSIONS[size];
  let containerClass = "inline-flex items-center justify-center rounded ";

  if (selected) {
    containerClass += "ring-2 ring-yellow-400 ";
  } else if (highlight) {
    containerClass += "ring-2 ring-blue-400 ";
  }

  return (
    <span className={containerClass.trim()} title={label}>
      {src && (
        <img
          src={src}
          alt={label}
          width={dimensions.width}
          height={dimensions.height}
          className="block object-contain"
          onError={(event) => {
            event.currentTarget.hidden = true;
            const fallback = event.currentTarget.nextElementSibling;
            if (fallback instanceof HTMLElement) fallback.hidden = false;
          }}
        />
      )}
      <span
        hidden={Boolean(src)}
        className={`inline-flex items-center justify-center rounded border border-gray-300 bg-white font-mono font-bold ${SUIT_COLOR[tile.suit]}`}
        style={dimensions}
      >
        {label}
      </span>
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
