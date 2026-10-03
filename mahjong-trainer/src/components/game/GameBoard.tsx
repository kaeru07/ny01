"use client";

import React from "react";
import { GameState } from "@/types/game";
import { PlayerIndex } from "@/types/mahjong";
import PlayerHand from "./PlayerHand";
import River from "./River";
import TileComponent from "./TileComponent";

interface GameBoardProps {
  gameState: GameState;
  canDiscard: boolean;
  onDiscard: (tileIndex: number) => void;
  controls?: React.ReactNode;
  openHands?: boolean;
}

const WIND_LABELS = { east: "東", south: "南", west: "西", north: "北" } as const;
const OPPONENT_NAMES: Record<1 | 2 | 3, string> = {
  1: "南家",
  2: "西家",
  3: "北家",
};

function ScoreEdge({
  gameState,
  playerIndex,
  position,
}: {
  gameState: GameState;
  playerIndex: PlayerIndex;
  position: "bottom" | "right" | "top" | "left";
}) {
  const player = gameState.players[playerIndex];
  const isCurrent = gameState.turn === playerIndex;

  return (
    <div className={`center-score center-score-${position} ${isCurrent ? "is-current" : ""}`}>
      <span className="center-score-wind">{WIND_LABELS[player.wind]}</span>
      <span className="center-score-value">{player.score.toLocaleString()}</span>
      {player.riichi && <span className="center-riichi-stick" aria-label={`${WIND_LABELS[player.wind]}家 立直`} />}
    </div>
  );
}

function OpponentHand({
  gameState,
  playerIndex,
  position,
  openHands,
}: {
  gameState: GameState;
  playerIndex: 1 | 2 | 3;
  position: "top" | "left" | "right";
  openHands: boolean;
}) {
  const player = gameState.players[playerIndex];
  const rotation = position === "left" ? 90 : position === "right" ? 270 : 180;
  const orientation = position === "top" ? "horizontal" : "vertical";

  return (
    <div className={`opponent-hand opponent-hand-${position}`}>
      <span className="opponent-hand-label">
        {OPPONENT_NAMES[playerIndex]}
        {player.riichi && <span className="opponent-riichi-badge">立直</span>}
      </span>
      <PlayerHand
        player={player}
        orientation={orientation}
        rotation={rotation}
        showTiles={openHands}
      />
    </div>
  );
}

export default function GameBoard({
  gameState,
  canDiscard,
  onDiscard,
  controls,
  openHands = false,
}: GameBoardProps) {
  const { players, dora, turn } = gameState;
  const self = players[0];
  const lastDiscardPlayer = ((turn + 3) % 4) as PlayerIndex;
  const junme = Math.max(1, Math.ceil(gameState.round.turnCount / 4));
  const doraBackCount = Math.max(0, 5 - dora.length);

  return (
    <div className="game-board select-none">
      <div className="table-surface">
        <div className="table-texture" aria-hidden="true" />
        <div className="table-frame" aria-hidden="true" />

        <div className="dora-panel">
          <div className="dora-copy">
            <span className="dora-label">ドラ表示</span>
            <span className="dora-sub">{dora.length <= 1 ? "表 1枚" : `槓ドラ +${dora.length - 1}`}</span>
          </div>
          <div className="dora-tiles">
            {dora.map((tile, index) => (
              <TileComponent key={`dora-${index}`} tileIndex={tile} size="sm" />
            ))}
            {Array.from({ length: doraBackCount }).map((_, index) => (
              <TileComponent key={`dora-back-${index}`} tileIndex={0} size="sm" faceDown />
            ))}
          </div>
        </div>

        <div className="round-pill">
          <span className="round-dot" />
          <span>{junme}巡目</span>
          <span className="round-wall">残 {gameState.wall.length}</span>
        </div>

        <OpponentHand gameState={gameState} playerIndex={2} position="top" openHands={openHands} />
        <OpponentHand gameState={gameState} playerIndex={3} position="left" openHands={openHands} />
        <OpponentHand gameState={gameState} playerIndex={1} position="right" openHands={openHands} />

        <div className="river-slot river-slot-top">
          <River
            discards={players[2].discards}
            rotation={180}
            highlightLast={lastDiscardPlayer === 2}
          />
        </div>
        <div className="river-slot river-slot-left">
          <River
            discards={players[3].discards}
            rotation={90}
            highlightLast={lastDiscardPlayer === 3}
          />
        </div>
        <div className="river-slot river-slot-right">
          <River
            discards={players[1].discards}
            rotation={270}
            highlightLast={lastDiscardPlayer === 1}
          />
        </div>
        <div className="river-slot river-slot-bottom">
          <River
            discards={self.discards}
            rotation={0}
            highlightLast={lastDiscardPlayer === 0}
          />
        </div>

        <div className="table-center">
          <span className="table-round">
            {WIND_LABELS[gameState.round.wind]}
            {gameState.round.number}局
          </span>
          <span className="table-round-detail">
            {gameState.round.honba}本場・供託 {players.filter((p) => p.riichi).length}
          </span>
          <span className="table-wall-count">残 {gameState.wall.length}</span>

          <ScoreEdge gameState={gameState} playerIndex={0} position="bottom" />
          <ScoreEdge gameState={gameState} playerIndex={1} position="right" />
          <ScoreEdge gameState={gameState} playerIndex={2} position="top" />
          <ScoreEdge gameState={gameState} playerIndex={3} position="left" />
        </div>

        {gameState.isPaused && (
          <div className="pause-overlay" role="status">
            <div className="pause-card">
              <strong>一時停止中</strong>
              <span>読みを整理してから再開できます</span>
            </div>
          </div>
        )}

        {controls && <div className="table-controls-slot">{controls}</div>}

        <div className="self-meta">
          <div className="self-meta-main">
            <span className="self-wind">{WIND_LABELS[self.wind]}</span>
            <span>親・あなた</span>
            <span className="self-score">{self.score.toLocaleString()}点</span>
          </div>
          <span className={`turn-guide ${turn === 0 ? "is-active" : ""}`}>
            {turn === 0 ? (canDiscard ? "打牌を選んでください" : "あなたの番") : `${WIND_LABELS[players[turn].wind]}家の手番`}
          </span>
        </div>

        <div className="self-hand-area">
          <PlayerHand
            player={self}
            isHuman
            canDiscard={canDiscard}
            onDiscard={onDiscard}
            showTiles
          />
        </div>
      </div>
    </div>
  );
}
