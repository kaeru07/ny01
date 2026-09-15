"use client";

import React from "react";
import { TileIndex } from "@/types/mahjong";
import TileComponent from "./TileComponent";

interface RiverProps {
  discards: TileIndex[];
  /** 自分=0 / 左家=90 / 対面=180 / 右家=270 */
  rotation?: 0 | 90 | 180 | 270;
}

const TILES_PER_ROW = 6;

export default function River({ discards, rotation = 0 }: RiverProps) {
  const vertical = rotation === 90 || rotation === 270;
  const rows: TileIndex[][] = [];

  for (let index = 0; index < discards.length; index += TILES_PER_ROW) {
    rows.push(discards.slice(index, index + TILES_PER_ROW));
  }

  const renderTiles = (row: TileIndex[], rowIndex: number) =>
    row.map((tile, tileIndex) => (
      <TileComponent
        key={`river-${rowIndex * TILES_PER_ROW + tileIndex}`}
        tileIndex={tile}
        size="sm"
        rotation={rotation}
      />
    ));

  let content: React.ReactNode = null;

  if (vertical) {
    // 左右の河は「6枚の縦列」を卓中央から外側へ最大3列並べる。
    // 左家は古い列が外側、右家は古い列が外側になるよう表示順を合わせる。
    const displayedRows = rotation === 90 ? [...rows].reverse() : rows;
    content = (
      <div className="river-columns">
        {displayedRows.map((row, displayIndex) => {
          const sourceIndex = rotation === 90 ? rows.length - 1 - displayIndex : displayIndex;
          return (
            <div key={sourceIndex} data-river-chunk={sourceIndex} className="river-column">
              {renderTiles(row, sourceIndex)}
            </div>
          );
        })}
      </div>
    );
  } else {
    // 上下の河は1行6枚。対面だけ新しい行が卓中央側に来るよう上下を反転する。
    const displayedRows = rotation === 180 ? [...rows].reverse() : rows;
    content = (
      <div className="river-rows">
        {displayedRows.map((row, displayIndex) => {
          const sourceIndex = rotation === 180 ? rows.length - 1 - displayIndex : displayIndex;
          return (
            <div key={sourceIndex} data-river-chunk={sourceIndex} className="river-row">
              {renderTiles(row, sourceIndex)}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`river river-${rotation}`}
      data-river-rotation={rotation}
      data-discard-count={discards.length}
    >
      {content}
    </div>
  );
}
