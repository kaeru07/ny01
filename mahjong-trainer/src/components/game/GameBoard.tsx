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

function TableSeat({
  gameState,
  playerIndex,
  position,
}: {
  gameState: GameState;
  playerIndex: 1 | 2 | 3;
  position: "top" | "left" | "right";
}) {
  const player = gameState.players[playerIndex];
  const isCurrent = gameState.turn === playerIndex;

  return (
    <div
      className={`table-seat table-seat-${position} ${isCurrent ? "is-current" : ""}`}
      aria-current={isCurrent ? "true" : undefined}
    >
      <div className="table-seat-name">
        <span>{WIND_LABELS[player.wind]}家</span>
        <span>{playerLabel(playerIndex)}</span>
        {player.riichi && <span className="table-seat-riichi">立直</span>}
      </div>
      <span className="table-seat-score">{player.score.toLocaleString()}</span>
    </div>
  );
}

export default function GameBoard({
  gameState,
  canDiscard,
  onDiscard,
}: GameBoardProps) {
  const { players, dora, turn } = gameState;
  const self = players[0];

  return (
    <div className="game-board select-none">
      <div className="table-stage">
        <div className="mahjong-table">
          <div className="table-inner-frame" aria-hidden="true" />

          <TableSeat gameState={gameState} playerIndex={2} position="top" />
          <TableSeat gameState={gameState} playerIndex={3} position="left" />
          <TableSeat gameState={gameState} playerIndex={1} position="right" />

          <div className="river-slot river-slot-top">
            <River discards={players[2].discards} rotation={180} />
          </div>
          <div className="river-slot river-slot-left">
            <River discards={players[3].discards} rotation={90} />
          </div>
          <div className="river-slot river-slot-right">
            <River discards={players[1].discards} rotation={270} />
          </div>
          <div className="river-slot river-slot-bottom">
            <River discards={self.discards} rotation={0} />
          </div>

          <div className="table-center">
            <span className="table-round">
              {WIND_LABELS[gameState.round.wind]}
              {gameState.round.number}局
            </span>
            <div className="table-center-rule" />
            <span className="table-round-detail">
              {gameState.round.honba}本場 ・ 供託0
            </span>
            <span className="table-wall-count">残り {gameState.wall.length}枚</span>
            <div className="table-dora">
              <span>ドラ</span>
              {dora.map((tile, index) => (
                <TileComponent key={index} tileIndex={tile} size="sm" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hand-area player-hand-panel">
        <div className="player-hand-meta">
          <div className="player-hand-name">
            <span>{WIND_LABELS[self.wind]}家（自分）</span>
            <span className="player-hand-score">{self.score.toLocaleString()}点</span>
            {turn === 0 && <span className="turn-dot">● あなたの番</span>}
          </div>
          {canDiscard && <span className="discard-prompt">打牌を選んでください</span>}
        </div>

        <PlayerHand
          player={self}
          isHuman
          canDiscard={canDiscard}
          onDiscard={onDiscard}
          showTiles
        />
      </div>
    </div>
  );
}
