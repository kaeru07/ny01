"use client";

import React from "react";
import { PlayerIndex } from "@/types/mahjong";
import { GameState } from "@/types/game";

interface GameControlsProps {
  gameState: GameState;
  onPause: () => void;
  onResume: () => void;
  onStartReading: (target: PlayerIndex) => void;
  onGoToReview: () => void;
  onStartGame: () => void;
  onNextRound: () => void;
}

const PLAYER_LABELS = ["CPU南", "CPU西", "CPU北"];
const PLAYER_INDICES: PlayerIndex[] = [1, 2, 3];

export default function GameControls({
  gameState,
  onPause,
  onResume,
  onStartReading,
  onGoToReview,
  onStartGame,
  onNextRound,
}: GameControlsProps) {
  const { phase, isPaused } = gameState;

  if (phase === "idle") {
    return (
      <div className="flex justify-center p-4">
        <button
          onClick={onStartGame}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-lg shadow-lg transition-all"
        >
          対局開始
        </button>
      </div>
    );
  }

  if (phase === "won" || phase === "ryukyoku") {
    return (
      <div className="flex gap-3 justify-center p-4 flex-wrap">
        <button
          onClick={onGoToReview}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow transition-all"
        >
          答え合わせを見る
        </button>
        <button
          onClick={onNextRound}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow transition-all"
        >
          次の局へ
        </button>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="flex justify-center p-4">
        <button
          onClick={onNextRound}
          className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow transition-all"
        >
          次の局へ
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* 一時停止 / 再開 */}
      <div className="flex gap-2 flex-wrap justify-center">
        {!isPaused ? (
          <button
            onClick={onPause}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg text-sm shadow transition-all"
          >
            ⏸ 一時停止
          </button>
        ) : (
          <button
            onClick={onResume}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm shadow transition-all animate-pulse"
          >
            ▶ 再開
          </button>
        )}
      </div>

      {/* 読みトレーニングボタン */}
      <div className="flex gap-1 flex-wrap justify-center">
        {PLAYER_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => onStartReading(PLAYER_INDICES[i])}
            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-lg text-xs shadow transition-all"
          >
            📖 {label}を読む
          </button>
        ))}
      </div>

      {/* ゲーム状態表示 */}
      <div className="text-center text-xs text-gray-400">
        山残り: {gameState.wall.length}枚 | {巡目label(gameState)}
        {isPaused && (
          <span className="ml-2 text-yellow-400 font-bold">⏸ 停止中</span>
        )}
      </div>
    </div>
  );
}

function 巡目label(state: GameState): string {
  const winds = ["東", "南", "西", "北"];
  const wind = winds[["east","south","west","north"].indexOf(state.round.wind)];
  return `${wind}${state.round.number}局 ${state.round.honba}本場`;
}
