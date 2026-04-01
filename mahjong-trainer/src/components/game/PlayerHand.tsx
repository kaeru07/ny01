"use client";

import React from "react";
import { Player } from "@/types/mahjong";
import TileComponent from "./TileComponent";

interface PlayerHandProps {
  player: Player;
  isHuman?: boolean;
  canDiscard?: boolean;
  onDiscard?: (tileIndex: number) => void;
  orientation?: "horizontal" | "vertical";
  showTiles?: boolean; // false = 裏向き
}

export default function PlayerHand({
  player,
  isHuman = false,
  canDiscard = false,
  onDiscard,
  orientation = "horizontal",
  showTiles = false,
}: PlayerHandProps) {
  const tileSize = isHuman ? "lg" : "sm";

  if (orientation === "vertical") {
    return (
      <div className="flex flex-col items-center gap-0.5">
        {player.hand.map((tile, i) => (
          <TileComponent
            key={`hand-${tile}-${i}`}
            tileIndex={tile}
            size="sm"
            faceDown={!showTiles}
          />
        ))}
        {player.drawnTile !== null && (
          <>
            <div className="h-1" />
            <TileComponent
              key="drawn"
              tileIndex={player.drawnTile}
              size="sm"
              faceDown={!showTiles}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ flexWrap: "nowrap" }}>
      {/* 手牌 */}
      {player.hand.map((tile, i) => (
        <TileComponent
          key={`hand-${tile}-${i}`}
          tileIndex={tile}
          size={tileSize}
          faceDown={!showTiles}
          onClick={canDiscard ? () => onDiscard?.(tile) : undefined}
          className="shrink-0"
        />
      ))}

      {/* ツモ牌 (手牌から少し離して表示) */}
      {player.drawnTile !== null && (
        <>
          <div className="w-3 shrink-0" />
          <TileComponent
            key="drawn"
            tileIndex={player.drawnTile}
            size={tileSize}
            highlighted={isHuman}
            faceDown={!showTiles}
            onClick={canDiscard ? () => onDiscard?.(player.drawnTile!) : undefined}
            className="shrink-0"
          />
        </>
      )}

      {/* 鳴き面子 */}
      {player.melds.map((meld, mi) => (
        <div key={`meld-${mi}`} className="flex gap-1 ml-2 border-l-2 border-yellow-400 pl-1 shrink-0">
          {meld.tiles.map((tile, ti) => (
            <TileComponent
              key={`meld-${mi}-${ti}`}
              tileIndex={tile}
              size={tileSize}
              faceDown={false}
            />
          ))}
        </div>
      ))}

      {/* 立直棒アイコン */}
      {player.riichi && (
        <span className="ml-2 text-red-500 font-bold text-sm self-center shrink-0">
          ⚡立直
        </span>
      )}
    </div>
  );
}
