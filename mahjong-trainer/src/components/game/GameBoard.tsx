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

function SeatScore({
  gameState,
  playerIndex,
  className = "",
}: {
  gameState: GameState;
  playerIndex: 0 | 1 | 2 | 3;
  className?: string;
}) {
  const player = gameState.players[playerIndex];
  const isCurrent = gameState.turn === playerIndex;

  return (
    <div
      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[9px] leading-none ${
        isCurrent
          ? "bg-amber-400 text-gray-950 shadow-[0_0_8px_rgba(251,191,36,0.55)]"
          : "bg-black/25 text-green-100"
      } ${className}`}
      aria-current={isCurrent ? "true" : undefined}
    >
      <span className="font-black">{WIND_LABELS[player.wind]}</span>
      <span className="tabular-nums">{player.score}</span>
    </div>
  );
}

export default function GameBoard({
  gameState,
  canDiscard,
  onDiscard,
}: GameBoardProps) {
  const { players, dora, turn, phase } = gameState;

  return (
    <div className="flex flex-col h-full gap-1 landscape:gap-0.5 select-none">
      {/* 上家 (CPU西, index=2) */}
      <div className="opponent-hand-area flex flex-col items-center gap-1 landscape:gap-0.5 p-2 landscape:p-1 bg-gray-800 rounded-lg border border-gray-700">
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
        <div className="table-viewport flex-1 grid place-items-center min-w-0 min-h-0">
        <div className="mahjong-table flex flex-col bg-green-900 rounded-xl border-2 border-green-700 overflow-hidden p-1.5 landscape:p-1 gap-1">
          {/* 対面(上, 180°) */}
          <div className="flex justify-center min-h-0">
            <River discards={players[2].discards} rotation={180} />
          </div>

          {/* 中段: 上家(左90°) | 中央情報 | 下家(右270°) */}
          <div className="flex-1 flex items-center justify-center gap-1.5 min-h-0">
            <div className="flex justify-end items-center">
              <River discards={players[3].discards} rotation={90} />
            </div>

            {/* 卓中央: 局情報・4家点数・手番・ドラ */}
            <div className="grid grid-cols-[auto_auto_auto] grid-rows-[auto_auto_auto] items-center gap-0.5 rounded-lg border border-green-700/80 bg-green-950/80 p-1 shadow-inner flex-shrink-0">
              <SeatScore gameState={gameState} playerIndex={2} className="col-start-2 justify-center" />
              <SeatScore gameState={gameState} playerIndex={3} className="col-start-1 row-start-2" />

              <div className="col-start-2 row-start-2 flex flex-col items-center gap-0.5 rounded bg-black/20 px-1.5 py-1">
                <span className="whitespace-nowrap text-[10px] font-black text-white">
                  {WIND_LABELS[gameState.round.wind]}{gameState.round.number}局
                  {gameState.round.honba > 0 && ` ${gameState.round.honba}本場`}
                </span>
                <span className="text-[8px] tabular-nums text-green-300">
                  供託 0本
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] text-green-300">ドラ</span>
                  {dora.map((t, i) => (
                    <TileComponent key={i} tileIndex={t} size="sm" />
                  ))}
                </div>
                <span className="text-[8px] tabular-nums text-green-300">
                  残り {gameState.wall.length}枚
                </span>
              </div>

              <SeatScore gameState={gameState} playerIndex={1} className="col-start-3 row-start-2" />
              <SeatScore gameState={gameState} playerIndex={0} className="col-start-2 row-start-3 justify-center" />
            </div>

            <div className="flex justify-start items-center">
              <River discards={players[1].discards} rotation={270} />
            </div>
          </div>

          {/* 自分(下, 0°) */}
          <div className="flex justify-center min-h-0">
            <River discards={players[0].discards} rotation={0} />
          </div>
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
