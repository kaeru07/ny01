"use client";

import React from "react";
import { DiscardRecord, TileIndex } from "@/types/mahjong";
import TileComponent from "./TileComponent";

interface RiverProps {
  discards: TileIndex[];
  records?: DiscardRecord[];
  rotation?: 0 | 90 | 180 | 270;
  highlightLast?: boolean;
}

const TILES_PER_ROW = 6;

export default function River({ discards, records = [], rotation = 0, highlightLast = false }: RiverProps) {
  const vertical = rotation === 90 || rotation === 270;
  const rows: TileIndex[][] = [];

  for (let index = 0; index < discards.length; index += TILES_PER_ROW) {
    rows.push(discards.slice(index, index + TILES_PER_ROW));
  }

  const renderTiles = (row: TileIndex[], rowIndex: number) =>
    row.map((tile, tileIndex) => {
      const absoluteIndex = rowIndex * TILES_PER_ROW + tileIndex;
      const record = records[absoluteIndex];
      const isLast = highlightLast && absoluteIndex === discards.length - 1;
      const tileRotation = record?.riichi
        ? (((rotation + 90) % 360) as 0 | 90 | 180 | 270)
        : rotation;
      return (
        <TileComponent
          key={`river-${absoluteIndex}`}
          tileIndex={tile}
          size="sm"
          rotation={tileRotation}
          className={`${isLast ? "river-last-tile" : ""} ${record?.tsumogiri ? "river-tsumogiri" : ""} ${record?.riichi ? "river-riichi-tile" : ""}`}
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
    <div className={`river river-${rotation}`} data-river-rotation={rotation} data-discard-count={discards.length}>
      {content}
    </div>
  );
}
