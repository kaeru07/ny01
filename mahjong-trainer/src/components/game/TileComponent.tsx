"use client";

import React from "react";
import { TileIndex } from "@/types/mahjong";
import { indexToTile, tileName } from "@/domain/mahjong/tile";

interface TileComponentProps {
  tileIndex: TileIndex;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  highlighted?: boolean; // ツモ牌ハイライト
  faceDown?: boolean;    // 裏向き表示
  onClick?: () => void;
  className?: string;
}

const HONOR_NAMES = ['east','south','west','north','white','green','red'] as const;

function getTileSrc(tileIndex: TileIndex): string {
  const tile = indexToTile(tileIndex);
  if (tile.suit === 'man')   return `/tiles/man/${tile.number}.svg`;
  if (tile.suit === 'pin')   return `/tiles/pin/${tile.number}.svg`;
  if (tile.suit === 'sou')   return `/tiles/sou/${tile.number}.svg`;
  return `/tiles/honor/${HONOR_NAMES[tile.number - 1]}.svg`;
}

// サイズはglobals.cssのCSS変数 (--tile-*) で制御
const sizeClasses: Record<string, string> = {
  sm: "tile-sm",
  md: "tile-md",
  lg: "tile-hand",
};

export default function TileComponent({
  tileIndex,
  size = "md",
  selected = false,
  highlighted = false,
  faceDown = false,
  onClick,
  className = "",
}: TileComponentProps) {
  const src  = faceDown ? '/tiles/back.svg' : getTileSrc(tileIndex);
  const alt  = faceDown ? '裏向き' : tileName(tileIndex);

  const baseClasses = [
    "relative inline-block rounded select-none overflow-hidden",
    "transition-all duration-150",
    sizeClasses[size],
    onClick ? "cursor-pointer" : "cursor-default",
  ].join(" ");

  const stateClasses = selected
    ? "-translate-y-2 shadow-lg ring-2 ring-yellow-400"
    : highlighted
    ? "-translate-y-1 shadow-md ring-2 ring-orange-400"
    : onClick
    ? "hover:-translate-y-0.5 hover:shadow"
    : "";

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${className}`}
      onClick={onClick}
      title={alt}
    >
      <img
        src={src}
        alt={alt}
        width="100%"
        height="100%"
        style={{ display: "block", width: "100%", height: "100%" }}
        draggable={false}
      />
      {/* 選択・ハイライトのカラーオーバーレイ */}
      {selected && (
        <div className="absolute inset-0 rounded bg-yellow-400/20 pointer-events-none" />
      )}
      {highlighted && (
        <div className="absolute inset-0 rounded bg-orange-400/20 pointer-events-none" />
      )}
    </div>
  );
}
