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
  openHands?: boolean;
  onToggleOpenHands?: () => void;
}

const PLAYER_LABELS = ["南家", "西家", "北家"];
const PLAYER_INDICES: PlayerIndex[] = [1, 2, 3];

export default function GameControls({
  gameState,
  onPause,
  onResume,
  onStartReading,
  onGoToReview,
  onStartGame,
  onNextRound,
  openHands = false,
  onToggleOpenHands,
}: GameControlsProps) {
  const { phase, isPaused } = gameState;

  if (phase === "idle") {
    return (
      <div className="start-control-wrap">
        <button onClick={onStartGame} className="primary-control-button">
          対局開始
        </button>
      </div>
    );
  }

  if (phase === "won" || phase === "ryukyoku") {
    return (
      <div className="end-control-wrap">
        <button onClick={onGoToReview} className="secondary-control-button">答え合わせ</button>
        <button onClick={onNextRound} className="primary-control-button">次の局へ</button>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="end-control-wrap">
        <button onClick={onNextRound} className="primary-control-button">次の局へ</button>
      </div>
    );
  }

  return (
    <div className="table-controls">
      <div className="control-primary-row">
        <button
          onClick={isPaused ? onResume : onPause}
          className={`glass-control-button ${isPaused ? "is-resume" : ""}`}
        >
          {isPaused ? "再開" : "停止"}
        </button>
        <button
          onClick={onToggleOpenHands}
          className={`glass-control-button ${openHands ? "is-on" : ""}`}
        >
          {openHands ? "手牌を伏せる" : "手牌開示"}
        </button>
      </div>

      <div className="reading-heading">
        <span>手牌読み</span>
        <span className="reading-heading-rule" />
      </div>

      <div className="reading-buttons">
        {PLAYER_LABELS.map((label, i) => {
          const player = gameState.players[PLAYER_INDICES[i]];
          return (
            <button
              key={label}
              onClick={() => onStartReading(PLAYER_INDICES[i])}
              className="reading-button"
            >
              <span>{label}</span>
              {player.riichi && <span className="reading-riichi">立直</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
