"use client";

import React, { useMemo, useState } from "react";
import { PlayerIndex, TileIndex } from "@/types/mahjong";
import { ReadAttempt } from "@/types/training";
import { GameState } from "@/types/game";
import TileComponent from "@/components/game/TileComponent";
import { getCurrentWaits } from "@/domain/mahjong/shanten";

interface ReadingModalProps {
  gameState: GameState;
  targetPlayer: PlayerIndex;
  currentAttempt: Partial<ReadAttempt>;
  onUpdate: (updates: Partial<ReadAttempt>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const PLAYER_NAMES: Record<1 | 2 | 3, string> = { 1: "南家", 2: "西家", 3: "北家" };
const GROUPS = [
  { label: "萬子", tiles: Array.from({ length: 9 }, (_, i) => i) },
  { label: "筒子", tiles: Array.from({ length: 9 }, (_, i) => i + 9) },
  { label: "索子", tiles: Array.from({ length: 9 }, (_, i) => i + 18) },
  { label: "字牌", tiles: Array.from({ length: 7 }, (_, i) => i + 27) },
];

export default function ReadingModal({
  gameState,
  targetPlayer,
  currentAttempt,
  onUpdate,
  onSubmit,
  onCancel,
}: ReadingModalProps) {
  const [activeTarget, setActiveTarget] = useState<1 | 2 | 3>((targetPlayer || 1) as 1 | 2 | 3);
  const [answered, setAnswered] = useState(false);
  const [noTenpai, setNoTenpai] = useState(false);
  const selected = currentAttempt.waitPrediction ?? [];
  const target = gameState.players[activeTarget];
  const actualWaits = useMemo(
    () => getCurrentWaits(target.hand, target.drawnTile, target.melds.length),
    [target.hand, target.drawnTile, target.melds.length]
  );
  const actualSet = useMemo(() => new Set(actualWaits), [actualWaits]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const correctCount = selected.filter((tile) => actualSet.has(tile)).length;
  const isNoTenpaiCorrect = noTenpai && actualWaits.length === 0;
  const allCorrect =
    (isNoTenpaiCorrect || (selected.length > 0 && correctCount === actualWaits.length && selected.length === actualWaits.length));

  const chooseTarget = (next: 1 | 2 | 3) => {
    setActiveTarget(next);
    setAnswered(false);
    setNoTenpai(false);
    onUpdate({ targetPlayer: next, waitPrediction: [] });
  };

  const toggleTile = (tile: TileIndex) => {
    if (answered) return;
    setNoTenpai(false);
    const next = selectedSet.has(tile) ? selected.filter((t) => t !== tile) : [...selected, tile];
    onUpdate({ targetPlayer: activeTarget, waitPrediction: next });
  };

  const chooseNoTenpai = () => {
    if (answered) return;
    setNoTenpai((value) => !value);
    onUpdate({ targetPlayer: activeTarget, waitPrediction: [] });
  };

  const answer = () => {
    onUpdate({ targetPlayer: activeTarget, waitPrediction: noTenpai ? [] : selected });
    setAnswered(true);
  };

  return (
    <div className="reading-sheet-backdrop" role="dialog" aria-modal="true" aria-label="待ち読みトレーニング">
      <section className="reading-sheet">
        <header className="reading-sheet-header">
          <div>
            <span className="reading-sheet-kicker">WAIT READING</span>
            <h2>待ちは？</h2>
          </div>
          <button className="reading-sheet-close" onClick={onCancel} aria-label="閉じる">×</button>
        </header>

        <div className="reading-target-tabs">
          {([1, 2, 3] as const).map((player) => (
            <button
              key={player}
              className={activeTarget === player ? "is-active" : ""}
              onClick={() => chooseTarget(player)}
            >
              {PLAYER_NAMES[player]}
              {gameState.players[player].riichi && <span>立直</span>}
            </button>
          ))}
        </div>

        <div className="reading-river-preview">
          <span>{PLAYER_NAMES[activeTarget]}の河</span>
          <div>
            {target.discards.slice(-12).map((tile, index) => (
              <TileComponent key={`${tile}-${index}`} tileIndex={tile} size="sm" />
            ))}
          </div>
        </div>

        <div className="reading-question-copy">
          <strong>{answered ? "答え合わせ" : "待ち牌を選択"}</strong>
          <span {answered ? "緑が実際の待ち、赤が外した予想です" : "複数選択できます。テンパイしていないと思う場合はノーテンを選択。"}</span>
        </div>

        <div className="wait-grid">
          {GROUPS.map((group) => (
            <div className="wait-group" key={group.label}>
              <span className="wait-group-label">{group.label}</span>
              <div className="wait-group-tiles">
                {group.tiles.map((tile) => {
                  const picked = selectedSet.has(tile);
                  const actual = actualSet.has(tile);
                  const resultClass = answered
                    ? actual
                      ? "is-correct"
                      : picked
                        ? "is-wrong"
                        : "is-dimmed"
                    : picked
                      ? "is-picked"
                      : "";
                  return (
                    <button key={tile} className={`wait-tile-button ${resultClass}`} onClick={() => toggleTile(tile)}>
                      <TileComponent tileIndex={tile} size="sm" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          className={`no-tenpai-button ${noTenpai ? "is-picked" : ""} ${answered && actualWaits.length === 0 ? "is-correct" : ""}`}
          onClick={chooseNoTenpai}
        >
          ノーテン
        </button>

        {answered && (
          <div className={`reading-result ${allCorrect ? "is-hit" : ""}`}>
            <strong>{allCorrect ? "的中" : actualWaits.length === 0 ? "実際はノーテン" : `${correctCount}/${actualWaits.length}枚 的中`}</strong>
            <span>
              {actualWaits.length === 0
                ? "この時点では有効な待ちはありません。"
                : `実際の待ち ${actualWaits.length}枚。河と手出し/ツモ切りから根拠を振り返ってください。`}
            </span>
          </div>
        )}

        <details className="reading-note-details">
          <summary>読みの根拠をメモ</summary>
          <textarea
            rows={3}
            value={currentAttempt.freeNote ?? ""}
            onChange={(e) => onUpdate({ freeNote: e.target.value })}
            placeholder="例：5巡目の3m手出し、立直前の6p手出しから…"
          />
        </details>

        <footer className="reading-sheet-footer">
          {!answered ? (
            <button className="reading-answer-button" disabled={!noTenpai && selected.length === 0} onClick={answer}>
              答え合わせ
            </button>
          ) : (
            <button className="reading-answer-button" onClick={onSubmit}>読みを記録して対局へ戻る</button>
          )}
        </footer>
      </section>
    </div>
  );
}
