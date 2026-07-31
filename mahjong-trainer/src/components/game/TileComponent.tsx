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
  redFive?: boolean;     // 赤5牌
  rotation?: 0 | 90 | 180 | 270; // 牌画像の回転（席方向）
  onClick?: () => void;
  className?: string;
}

const HONOR_NAMES = ['east','south','west','north','white','green','red'] as const;

function getTileSrc(tileIndex: TileIndex, redFive = false): string {
  const tile = indexToTile(tileIndex);
  const isRed = redFive && tile.number === 5;
  if (tile.suit === 'man')   return isRed ? `/tiles/man/5-red.svg` : `/tiles/man/${tile.number}.svg`;
  if (tile.suit === 'pin')   return isRed ? `/tiles/pin/5-red.svg` : `/tiles/pin/${tile.number}.svg`;
  if (tile.suit === 'sou')   return isRed ? `/tiles/sou/5-red.svg` : `/tiles/sou/${tile.number}.svg`;
  return `/tiles/honor/${HONOR_NAMES[tile.number - 1]}.svg`;
}

// サイズはglobals.cssのCSS変数 (--tile-*) で制御
const sizeClasses: Record<string, string> = {
  sm: "tile-sm",
  md: "tile-md",
  lg: "tile-hand",
};

// 回転時に縦横を入れ替えるため、サイズごとの幅/高さ変数名を持つ
const sizeVars: Record<string, { w: string; h: string }> = {
  sm: { w: "var(--tile-sm-w)", h: "var(--tile-sm-h)" },
  md: { w: "var(--tile-md-w)", h: "var(--tile-md-h)" },
  lg: { w: "var(--tile-hand-w)", h: "var(--tile-hand-h)" },
};

export default function TileComponent({
  tileIndex,
  size = "md",
  selected = false,
  highlighted = false,
  faceDown = false,
  redFive = false,
  rotation = 0,
  onClick,
  className = "",
}: TileComponentProps) {
  const src  = faceDown ? '/tiles/back.svg' : getTileSrc(tileIndex, redFive);
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

  const rotated90 = rotation === 90 || rotation === 270;
  const sv = sizeVars[size];

  // 回転なし: これまで通り sizeClass でサイズ制御。
  if (rotation === 0) {
    return (
      <div className={`${baseClasses} ${stateClasses} ${className}`} onClick={onClick} title={alt}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} style={{ display: "block", width: "100%", height: "100%" }} draggable={false} />
        {selected && <div className="absolute inset-0 rounded bg-yellow-400/20 pointer-events-none" />}
        {highlighted && <div className="absolute inset-0 rounded bg-orange-400/20 pointer-events-none" />}
      </div>
    );
  }

  // 回転あり: 外側フットプリントは 90/270 で縦横入替。内側 img は元の縦横のまま回転。
  const outerW = rotated90 ? sv.h : sv.w;
  const outerH = rotated90 ? sv.w : sv.h;
  const rotClasses = [
    "relative inline-block rounded select-none overflow-hidden flex-shrink-0",
    onClick ? "cursor-pointer" : "cursor-default",
    stateClasses,
    className,
  ].join(" ");

  return (
    <div className={rotClasses} onClick={onClick} title={alt} style={{ width: outerW, height: outerH }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: sv.w,
          height: sv.h,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transformOrigin: "center center",
        }}
      />
      {selected && <div className="absolute inset-0 rounded bg-yellow-400/20 pointer-events-none" />}
      {highlighted && <div className="absolute inset-0 rounded bg-orange-400/20 pointer-events-none" />}
    </div>
  );
}
