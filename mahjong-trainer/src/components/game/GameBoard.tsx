"use client";

import React from "react";
import { GameState } from "@/types/game";
import { PlayerIndex } from "@/types/mahjong";
import PlayerHand from "./PlayerHand";
import River from "./River";
import TileComponent from "./TileComponent";
import { playerLabel } from "@/engine/gameEngine";

interface GameBoardProps {
  gameState: GameState;
  canDiscard: boolean;
  onDiscard: (tileIndex: number) => void;
  onStartReading?: (target: PlayerIndex) => void;
}

const WIND_LABELS = { east: "東", south: "南", west: "西", north: "北" };

export default function GameBoard({
  gameState,
  canDiscard,
  onDiscard,
  onStartReading,
}: GameBoardProps) {
  const { players, dora, turn, phase } = gameState;

  return (
    <div className="flex flex-col h-full gap-1 select-none">
      {/* 上家 (CPU西, index=2) */}
      <div className="flex flex-col items-center gap-1 p-2 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {WIND_LABELS[players[2].wind]} {playerLabel(2)}
          </span>
          <span className="text-xs text-gray-500">
            {players[2].score.toLocaleString()}点
          </span>
          {turn === 2 && <span className="text-yellow-400 text-xs">●</span>}
        </div>
        <PlayerHand
          player={players[2]}
          isHuman={false}
          showTiles={phase === "review"}
        />
      </div>

      {/* 中段: 左家(CPU北,3) | 卓中央 | 右家(CPU南,1) */}
      <div className="flex flex-1 gap-1 min-h-0">
        {/* 左家 (CPU北, index=3) */}
        <div className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-800 rounded-lg border border-gray-700 w-20">
          <span className="text-xs text-gray-400 [writing-mode:vertical-rl]">
            {WIND_LABELS[players[3].wind]} {playerLabel(3)}
          </span>
          {turn === 3 && <span className="text-yellow-400 text-xs">●</span>}
          <PlayerHand
            player={players[3]}
            isHuman={false}
            orientation="vertical"
            showTiles={phase === "review"}
          />
        </div>

        {/* 卓中央エリア */}
        <div className="flex-1 flex flex-col bg-green-900 rounded-xl border-2 border-green-700 overflow-hidden">
          {/* 河エリア */}
          <div className="flex-1 grid grid-cols-2 gap-2 p-2 overflow-auto">
            {/* 上家河 */}
            <div className="col-span-2 flex justify-center">
              <River discards={players[2].discards} label={playerLabel(2)} />
            </div>
            {/* 左家河 */}
            <div className="flex justify-start">
              <River discards={players[3].discards} label={playerLabel(3)} />
            </div>
            {/* 右家河 */}
            <div className="flex justify-end">
              <River discards={players[1].discards} label={playerLabel(1)} />
            </div>
            {/* 自家河 */}
            <div className="col-span-2 flex justify-center">
              <River discards={players[0].discards} label="あなた" />
            </div>
          </div>

          {/* 卓中央: ドラ・残り牌数 */}
          <div className="flex items-center justify-center gap-3 p-1 bg-green-800 border-t border-green-700">
            <div className="flex items-center gap-1">
              <span className="text-xs text-green-300">ドラ</span>
              {dora.map((t, i) => (
                <TileComponent key={i} tileIndex={t} size="sm" />
              ))}
            </div>
            <span className="text-xs text-green-300">
              山: {gameState.wall.length}
            </span>
          </div>
        </div>

        {/* 右家 (CPU南, index=1) */}
        <div className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-800 rounded-lg border border-gray-700 w-20">
          <span className="text-xs text-gray-400 [writing-mode:vertical-rl]">
            {WIND_LABELS[players[1].wind]} {playerLabel(1)}
          </span>
          {turn === 1 && <span className="text-yellow-400 text-xs">●</span>}
          <PlayerHand
            player={players[1]}
            isHuman={false}
            orientation="vertical"
            showTiles={phase === "review"}
          />
        </div>
      </div>

      {/* 自分の手牌エリア (下) */}
      <div className="p-2 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-300 font-bold">
              あなた ({WIND_LABELS[players[0].wind]})
            </span>
            <span className="text-xs text-gray-500">
              {players[0].score.toLocaleString()}点
            </span>
            {turn === 0 && <span className="text-yellow-400 text-xs font-bold">● あなたの番</span>}
          </div>
          {canDiscard && (
            <span className="text-xs text-green-400 animate-pulse">
              打牌を選んでください
            </span>
          )}
        </div>
        <PlayerHand
          player={players[0]}
          isHuman={true}
          canDiscard={canDiscard}
          onDiscard={onDiscard}
          showTiles={true}
        />
      </div>

      {/* 読むボタン行 */}
      {onStartReading && (
        <div className="flex gap-2 justify-center shrink-0">
          {([1, 2, 3] as PlayerIndex[]).map((idx) => (
            <button
              key={idx}
              onClick={() => onStartReading(idx)}
              className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold rounded-lg text-sm shadow-md transition-colors"
            >
              📖 {playerLabel(idx)}を読む
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
