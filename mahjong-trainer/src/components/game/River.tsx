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
      <div className="flex flex-col items-start gap-1">
        <span className="text-gray-300 text-xs">{label}の河</span>
        <div className="text-gray-500 text-xs italic">なし</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-gray-300 text-xs mb-0.5">{label}の河</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(6, auto)" }}>
        {discards.map((tile, i) => (
          <TileComponent
            key={`river-${i}`}
            tileIndex={tile}
            size="sm"
            faceDown={false}
          />
        ))}
      </div>
    </div>
  );
}
