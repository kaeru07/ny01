"use client";

import React from "react";
import { GameState } from "@/types/game";
import PlayerHand from "./PlayerHand";
import River from "./River";
import TileComponent from "./TileComponent";
import { playerLabel } from "@/engine/gameEngine";

interface GameBoardProps {
  gameState: GameState;
  canDiscard: boolean;
  onDiscard: (tileIndex: number) => void;
}

const WIND_LABELS = { east: "東", south: "南", west: "西", north: "北" };

export default function GameBoard({
  gameState,
  canDiscard,
  onDiscard,
}: GameBoardProps) {
  const { players, dora, turn, phase } = gameState;

  return (
    <div className="flex flex-col h-full gap-1 landscape:gap-0.5 select-none">
      {/* 上家 (CPU西, index=2) */}
      <div className="flex flex-col items-center gap-1 landscape:gap-0.5 p-2 landscape:p-1 bg-gray-800 rounded-lg border border-gray-700">
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
      <div className="flex flex-1 gap-1 landscape:gap-0.5 min-h-0">
        {/* 左家 (CPU北, index=3) */}
        <div className="flex flex-col items-center justify-center gap-1 landscape:gap-0.5 p-1 bg-gray-800 rounded-lg border border-gray-700 w-14 landscape:w-10 overflow-hidden min-h-0">
          <span className="text-xs text-gray-400 [writing-mode:vertical-rl]">
            {WIND_LABELS[players[3].wind]} {playerLabel(3)}
          </span>
          {turn === 3 && <span className="text-yellow-400 text-xs">●</span>}
          <div className="overflow-hidden flex-1 min-h-0 flex items-center">
            <PlayerHand
              player={players[3]}
              isHuman={false}
              orientation="vertical"
              showTiles={phase === "review"}
            />
          </div>
        </div>

        {/* 卓中央エリア: 4人の河を風車状に配置。牌は各席方向へ回転する。
            上段=対面(180°) / 中段=上家(左90°)・中央情報・下家(右270°) / 下段=自分(0°)
            左右は牌が外側(そのプレイヤー側)を向くように回転する。 */}
        <div className="flex-1 flex flex-col bg-green-900 rounded-xl border-2 border-green-700 overflow-hidden p-1.5 landscape:p-1 gap-1">
          {/* 対面(上, 180°) */}
          <div className="flex justify-center min-h-0">
            <River discards={players[2].discards} label={playerLabel(2)} rotation={180} />
          </div>

          {/* 中段: 上家(左90°) | 中央情報 | 下家(右270°) */}
          <div className="flex-1 flex items-center justify-center gap-1.5 min-h-0">
            <div className="flex justify-end items-center">
              <River discards={players[3].discards} label={playerLabel(3)} rotation={90} />
            </div>

            {/* 卓中央: ドラ・残り牌数 */}
            <div className="flex flex-col items-center justify-center gap-1 bg-green-950/60 rounded-lg px-2 py-1.5 flex-shrink-0">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-green-300">ドラ</span>
                <div className="flex gap-0.5">
                  {dora.map((t, i) => (
                    <TileComponent key={i} tileIndex={t} size="sm" />
                  ))}
                </div>
              </div>
              <span className="text-[10px] text-green-300">山 {gameState.wall.length}</span>
            </div>

            <div className="flex justify-start items-center">
              <River discards={players[1].discards} label={playerLabel(1)} rotation={270} />
            </div>
          </div>

          {/* 自分(下, 0°) */}
          <div className="flex justify-center min-h-0">
            <River discards={players[0].discards} label="あなた" rotation={0} />
          </div>
        </div>

        {/* 右家 (CPU南, index=1) */}
        <div className="flex flex-col items-center justify-center gap-1 landscape:gap-0.5 p-1 bg-gray-800 rounded-lg border border-gray-700 w-14 landscape:w-10 overflow-hidden min-h-0">
          <span className="text-xs text-gray-400 [writing-mode:vertical-rl]">
            {WIND_LABELS[players[1].wind]} {playerLabel(1)}
          </span>
          {turn === 1 && <span className="text-yellow-400 text-xs">●</span>}
          <div className="overflow-hidden flex-1 min-h-0 flex items-center">
            <PlayerHand
              player={players[1]}
              isHuman={false}
              orientation="vertical"
              showTiles={phase === "review"}
            />
          </div>
        </div>
      </div>

      {/* 自分の手牌エリア (下)。hand-area で container query の基準幅にする */}
      <div className="hand-area p-2 landscape:p-1 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-1 landscape:mb-0.5">
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

    </div>
  );
}
