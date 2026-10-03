"use client";

import React from "react";
import { TileIndex } from "@/types/mahjong";
import TileComponent from "./TileComponent";

interface RiverProps {
  discards: TileIndex[];
  /** 自分=0 / 左家=90 / 対面=180 / 右家=270 */
  rotation?: 0 | 90 | 180 | 270;
  highlightLast?: boolean;
}

const TILES_PER_ROW = 6;

export default function River({ discards, rotation = 0, highlightLast = false }: RiverProps) {
  const vertical = rotation === 90 || rotation === 270;
  const rows: TileIndex[][] = [];

  for (let index = 0; index < discards.length; index += TILES_PER_ROW) {
    rows.push(discards.slice(index, index + TILES_PER_ROW));
  }

  const renderTiles = (row: TileIndex[], rowIndex: number) =>
    row.map((tile, tileIndex) => {
      const absoluteIndex = rowIndex * TILES_PER_ROW + tileIndex;
      const isLast = highlightLast && absoluteIndex === discards.length - 1;
      return (
        <TileComponent
          key={`river-${absoluteIndex}`}
          tileIndex={tile}
          size="sm"
          rotation={rotation}
          className={isLast ? "river-last-tile" : ""}
        />
      );
    });

  let content: React.ReactNode = null;

  if (vertical) {
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
