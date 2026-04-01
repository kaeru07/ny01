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

// 各スート・数字の表示文字
function getTileDisplay(tileIndex: TileIndex): { char: string; color: string } {
  const tile = indexToTile(tileIndex);

  if (tile.suit === "honor") {
    const chars = ["東", "南", "西", "北", "白", "発", "中"];
    const colors = [
      "text-blue-700",
      "text-red-600",
      "text-gray-600",
      "text-green-700",
      "text-gray-300",
      "text-green-600",
      "text-red-600",
    ];
    return { char: chars[tile.number - 1], color: colors[tile.number - 1] };
  }

  const suitColors: Record<string, string> = {
    man: "text-red-600",
    pin: "text-blue-600",
    sou: "text-green-700",
  };

  const suitChars: Record<string, string[]> = {
    man: ["一", "二", "三", "四", "五", "六", "七", "八", "九"],
    pin: ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"],
    sou: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  };

  return {
    char: suitChars[tile.suit][tile.number - 1],
    color: suitColors[tile.suit],
  };
}

const sizeClasses = {
  sm: "w-7 h-10 text-xs",
  md: "w-9 h-12 text-sm",
  lg: "w-11 h-14 text-sm",
};

const suitLabel: Record<string, string> = {
  man: "m",
  pin: "p",
  sou: "s",
  honor: "",
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
  const tile = indexToTile(tileIndex);
  const { char, color } = getTileDisplay(tileIndex);

  const baseClasses = `
    inline-flex flex-col items-center justify-center
    rounded border-2 font-bold select-none
    transition-all duration-150
    ${sizeClasses[size]}
    ${onClick ? "cursor-pointer" : "cursor-default"}
  `;

  const stateClasses = faceDown
    ? "bg-green-800 border-green-600"
    : selected
    ? "bg-yellow-200 border-yellow-500 -translate-y-2 shadow-lg"
    : highlighted
    ? "bg-orange-100 border-orange-400 -translate-y-1 shadow-md"
    : "bg-amber-50 border-amber-300 hover:border-amber-500 hover:shadow";

  if (faceDown) {
    return (
      <div
        className={`${baseClasses} ${stateClasses} ${className}`}
        onClick={onClick}
        title="裏向き"
      >
        <span className="text-green-300 text-lg">🀫</span>
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${className}`}
      onClick={onClick}
      title={tileName(tileIndex)}
    >
      <span className={`font-bold leading-none ${color} ${size === "sm" ? "text-xs" : "text-sm"}`}>
        {char}
      </span>
      {tile.suit !== "honor" && (
        <span className="text-gray-400 leading-none" style={{ fontSize: "8px" }}>
          {suitLabel[tile.suit]}
        </span>
      )}
    </div>
  );
}
