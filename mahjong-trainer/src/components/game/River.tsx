"use client";

import React from "react";
import { TileIndex } from "@/types/mahjong";
import TileComponent from "./TileComponent";

interface RiverProps {
  discards: TileIndex[];
  label: string;
  direction?: "horizontal" | "vertical";
}

export default function River({
  discards,
  label,
  direction = "horizontal",
}: RiverProps) {
  if (discards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-gray-400 text-xs">{label}</span>
        <div className="text-gray-500 text-xs italic">なし</div>
      </div>
    );
  }

  // 6枚ずつ折り返して表示
  const rows: TileIndex[][] = [];
  for (let i = 0; i < discards.length; i += 6) {
    rows.push(discards.slice(i, i + 6));
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-gray-300 text-xs mb-0.5">{label}の河</span>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-0.5">
          {row.map((tile, ti) => (
            <TileComponent
              key={`river-${ri}-${ti}`}
              tileIndex={tile}
              size="sm"
              faceDown={false}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
