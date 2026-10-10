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
  // Reserve space for meld separators, draw gap, and riichi label before sizing tiles.
  // Counting only the 13/14 concealed tiles causes melded hands to clip on iPhone.
  const meldTileCount = player.melds.reduce((count, meld) => count + meld.tiles.length, 0);
  const totalTileCount = Math.max(1, player.hand.length + (player.drawnTile === null ? 0 : 1) + meldTileCount);
  const reservedPixels = 18 + player.melds.length * 14 + (player.drawnTile === null ? 0 : 8) + (player.riichi ? 44 : 0) + totalTileCount * 3;
  const handRowStyle = isHuman ? {
    "--tile-hand-w": `min(36px, calc((100cqw - ${reservedPixels}px) / ${totalTileCount}))`,
  } as React.CSSProperties : undefined;

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
    <div className="hand-row" style={handRowStyle}>
      {/* 手牌 */}
      {player.hand.map((tile, i) => (
        <TileComponent
          key={`hand-${tile}-${i}`}
          tileIndex={tile}
          size={tileSize}
          faceDown={!showTiles}
          onClick={canDiscard ? () => onDiscard?.(tile) : undefined}
        />
      ))}

      {/* ツモ牌 (手牌から少し離して表示) */}
      {player.drawnTile !== null && (
        <>
          <div className="w-2 shrink-0" />
          <TileComponent
            key="drawn"
            tileIndex={player.drawnTile}
            size={tileSize}
            highlighted={isHuman}
            faceDown={!showTiles}
            onClick={canDiscard ? () => onDiscard?.(player.drawnTile!) : undefined}
          />
        </>
      )}

      {/* 鳴き面子 */}
      {player.melds.map((meld, mi) => (
        <div key={`meld-${mi}`} className="flex gap-0.5 ml-1.5 border-l-2 border-yellow-400 pl-1 shrink-0">
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
        <span className="ml-1.5 text-red-500 font-bold text-xs self-center shrink-0">
          ⚡立直
        </span>
      )}
    </div>
  );
}
