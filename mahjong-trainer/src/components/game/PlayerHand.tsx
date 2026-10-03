"use client";

import React, { useEffect, useState } from "react";
import { Player } from "@/types/mahjong";
import TileComponent from "./TileComponent";

interface PlayerHandProps {
  player: Player;
  isHuman?: boolean;
  canDiscard?: boolean;
  onDiscard?: (tileIndex: number) => void;
  orientation?: "horizontal" | "vertical";
  rotation?: 0 | 90 | 180 | 270;
  showTiles?: boolean;
}

export default function PlayerHand({
  player,
  isHuman = false,
  canDiscard = false,
  onDiscard,
  orientation = "horizontal",
  rotation = 0,
  showTiles = false,
}: PlayerHandProps) {
  const tileSize = isHuman ? "lg" : "sm";
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedKey(null);
  }, [player.hand, player.drawnTile, canDiscard]);

  const handleTileTap = (key: string, tile: number) => {
    if (!canDiscard || !isHuman) return;
    if (selectedKey === key) {
      setSelectedKey(null);
      onDiscard?.(tile);
      return;
    }
    setSelectedKey(key);
  };

  const handTiles = (
    <>
      {player.hand.map((tile, i) => {
        const key = `hand-${i}`;
        return (
          <TileComponent
            key={`${key}-${tile}`}
            tileIndex={tile}
            size={tileSize}
            faceDown={!showTiles}
            rotation={rotation}
            selected={selectedKey === key}
            onClick={canDiscard && isHuman ? () => handleTileTap(key, tile) : undefined}
          />
        );
      })}
      {player.drawnTile !== null && (
        <div className="drawn-tile-gap">
          <TileComponent
            key={`drawn-${player.drawnTile}`}
            tileIndex={player.drawnTile}
            size={tileSize}
            rotation={rotation}
            selected={selectedKey === "drawn"}
            highlighted={isHuman && selectedKey !== "drawn"}
            faceDown={!showTiles}
            onClick={canDiscard && isHuman ? () => handleTileTap("drawn", player.drawnTile!) : undefined}
          />
        </div>
      )}
    </>
  );

  const melds = player.melds.map((meld, mi) => (
    <div key={`meld-${mi}`} className="meld-group">
      {meld.tiles.map((tile, ti) => (
        <TileComponent
          key={`meld-${mi}-${ti}`}
          tileIndex={tile}
          size={tileSize}
          faceDown={meld.type === "ankan" && (ti === 0 || ti === meld.tiles.length - 1)}
          rotation={rotation}
        />
      ))}
    </div>
  ));

  if (orientation === "vertical") {
    return (
      <div className="hand-row hand-row-vertical">
        <div className="concealed-hand concealed-hand-vertical">{handTiles}</div>
        {melds.length > 0 && <div className="melds melds-vertical">{melds}</div>}
      </div>
    );
  }

  return (
    <div className={`hand-row ${isHuman ? "hand-row-human" : "hand-row-opponent"}`}>
      <div className="concealed-hand">{handTiles}</div>
      {melds.length > 0 && <div className="melds">{melds}</div>}
    </div>
  );
}
