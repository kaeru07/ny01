"use client";

import React from "react";
import { TileIndex } from "@/types/mahjong";
import { indexToTile, tileName } from "@/domain/mahjong/tile";

interface TileComponentProps {
  tileIndex: TileIndex;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  highlighted?: boolean;
  faceDown?: boolean;
  redFive?: boolean;
  rotation?: 0 | 90 | 180 | 270;
  onClick?: () => void;
  className?: string;
}

const HONOR_NAMES = ["east", "south", "west", "north", "white", "green", "red"] as const;

function getTileSrc(tileIndex: TileIndex, redFive = false): string {
  const tile = indexToTile(tileIndex);
  const isRed = redFive && tile.number === 5;
  if (tile.suit === "man") return isRed ? "/tiles/man/5-red.svg" : `/tiles/man/${tile.number}.svg`;
  if (tile.suit === "pin") return isRed ? "/tiles/pin/5-red.svg" : `/tiles/pin/${tile.number}.svg`;
  if (tile.suit === "sou") return isRed ? "/tiles/sou/5-red.svg" : `/tiles/sou/${tile.number}.svg`;
  return `/tiles/honor/${HONOR_NAMES[tile.number - 1]}.svg`;
}

const sizeClasses: Record<string, string> = {
  sm: "tile-sm",
  md: "tile-md",
  lg: "tile-hand",
};

const sizeVars: Record<string, { w: string; h: string }> = {
  sm: { w: "var(--tile-sm-w)", h: "var(--tile-sm-h)" },
  md: { w: "var(--tile-md-w)", h: "var(--tile-md-h)" },
  lg: { w: "var(--tile-hand-w)", h: "var(--tile-hand-h)" },
};

function FaceArtwork({ src, alt }: { src: string; alt: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="mahjong-tile-image mahjong-tile-shell"
        src="/tiles/front.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="mahjong-tile-image mahjong-tile-mark"
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
      />
    </>
  );
}

function TileArtwork({ faceDown, src, alt }: { faceDown: boolean; src: string; alt: string }) {
  if (faceDown) return <span className="mahjong-tile-back" aria-label={alt} />;
  return <FaceArtwork src={src} alt={alt} />;
}

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
  const src = getTileSrc(tileIndex, redFive);
  const alt = faceDown ? "裏向き" : tileName(tileIndex);

  const baseClasses = [
    "mahjong-tile relative inline-block select-none overflow-hidden",
    sizeClasses[size],
    onClick ? "cursor-pointer" : "cursor-default",
  ].join(" ");

  const stateClasses = selected
    ? "is-selected"
    : highlighted
      ? "is-highlighted"
      : onClick
        ? "is-clickable"
        : "";

  const rotated90 = rotation === 90 || rotation === 270;
  const sv = sizeVars[size];

  if (rotation === 0) {
    return (
      <div className={`${baseClasses} ${stateClasses} ${className}`} onClick={onClick} title={alt}>
        <TileArtwork faceDown={faceDown} src={src} alt={alt} />
      </div>
    );
  }

  const outerW = rotated90 ? sv.h : sv.w;
  const outerH = rotated90 ? sv.w : sv.h;

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${className}`}
      onClick={onClick}
      title={alt}
      style={{ width: outerW, height: outerH }}
    >
      <div
        className="mahjong-tile-rotator"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: sv.w,
          height: sv.h,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          transformOrigin: "center center",
        }}
      >
        <TileArtwork faceDown={faceDown} src={src} alt={alt} />
      </div>
    </div>
  );
}
