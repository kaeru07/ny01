"use client";

import React from "react";
import { TileIndex } from "@/types/mahjong";
import TileComponent from "./TileComponent";

interface RiverProps {
  discards: TileIndex[];
  /** 席方向。牌画像をこの角度で回転し、河の並び方向も席に合わせる。
   *  self=0(下向き/6列横), toimen=180(上向き/6列横),
   *  kamicha(上家/左)=270, shimocha(下家/右)=90 → 縦に積む。 */
  rotation?: 0 | 90 | 180 | 270;
}

const CHUNK = 6;

export default function River({
  discards,
  rotation = 0,
}: RiverProps) {
  const vertical = rotation === 90 || rotation === 270;

  if (discards.length === 0) return null;

  // 6枚ごとに区切る
  const chunks: TileIndex[][] = [];
  for (let i = 0; i < discards.length; i += CHUNK) chunks.push(discards.slice(i, i + CHUNK));

  const tiles = (chunk: TileIndex[], base: number) =>
    chunk.map((tile, i) => (
      <TileComponent key={`r-${base + i}`} tileIndex={tile} size="sm" rotation={rotation} faceDown={false} />
    ));

  let grid: React.ReactNode;
  if (vertical) {
    // 上家(270)/下家(90): チャンクを横に並べ、各チャンクは縦積み。
    // 下家(右,90)は最新チャンクが卓中央側(左)に来るよう逆順で並べる。
    const display = rotation === 90 ? [...chunks].reverse() : chunks;
    grid = (
      <div className="flex flex-row" style={{ gap: "var(--river-gap)" }}>
        {display.map((chunk, ci) => {
          const orig = rotation === 90 ? chunks.length - 1 - ci : ci;
          return (
            <div key={ci} data-river-chunk={orig} className="flex flex-col" style={{ gap: "var(--river-gap)" }}>
              {tiles(chunk, orig * CHUNK)}
            </div>
          );
        })}
      </div>
    );
  } else {
    // 自分(0)/対面(180): チャンクを縦に積み、各チャンクは横並び(6列)。
    // 対面(180)は最新チャンクが卓中央側(下)に来るよう逆順。
    const display = rotation === 180 ? [...chunks].reverse() : chunks;
    grid = (
      <div className="flex flex-col" style={{ gap: "var(--river-gap)" }}>
        {display.map((chunk, ci) => {
          const orig = rotation === 180 ? chunks.length - 1 - ci : ci;
          return (
            <div key={ci} data-river-chunk={orig} className="flex flex-row" style={{ gap: "var(--river-gap)" }}>
              {tiles(chunk, orig * CHUNK)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div data-river-rotation={rotation} data-discard-count={discards.length}>
      {grid}
    </div>
  );
}
