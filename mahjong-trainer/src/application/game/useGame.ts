"use client";

import { useReducer, useEffect, useCallback, useRef } from "react";
import { GameState, GameAction } from "@/types/game";
import { TileIndex, PlayerIndex } from "@/types/mahjong";
import {
  gameReducer,
  createInitialState,
  checkTsumoWin,
  playerLabel,
} from "@/engine/gameEngine";
import { processCpuTurn } from "@/engine/cpuPlayer";

const CPU_DELAY_MS = 800; // CPU行動の遅延 (ms)

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const processingRef = useRef(false);

  // ゲーム開始
  const startGame = useCallback(() => {
    dispatch({ type: "START_GAME" });
  }, []);

  // 人間プレイヤーが牌を打牌
  const discardTile = useCallback(
    (tileIndex: TileIndex) => {
      if (state.turn !== 0) return; // 自分の番のみ
      if (state.isPaused) return;   // 一時停止中は操作不可
      if (state.phase !== "playing") return;
      dispatch({ type: "DISCARD_TILE", tileIndex });
    },
    [state.turn, state.isPaused, state.phase]
  );

  // 一時停止 / 再開
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const resume = useCallback(() => dispatch({ type: "RESUME" }), []);

  // レビューへ移行
  const goToReview = useCallback(
    () => dispatch({ type: "START_REVIEW" }),
    []
  );

  // 次の局
  const nextRound = useCallback(() => dispatch({ type: "NEXT_ROUND" }), []);

  // ============================================================
  // CPUターン自動処理
  // ============================================================
  useEffect(() => {
    if (state.phase !== "playing") return;
    if (state.isPaused) return;
    if (state.turn === 0) return; // 人間の番は自動処理しない
    if (processingRef.current) return;

    const currentPlayer = state.players[state.turn];

    // CPUがまだツモっていない場合、まずDRAW_TILEをdispatch
    if (currentPlayer.drawnTile === null && state.wall.length > 0) {
      processingRef.current = true;
      const timer = setTimeout(() => {
        dispatch({ type: "DRAW_TILE" });
        processingRef.current = false;
      }, CPU_DELAY_MS / 2);
      return () => clearTimeout(timer);
    }

    // ツモ済みの場合、打牌を処理
    if (currentPlayer.drawnTile !== null) {
      processingRef.current = true;
      const timer = setTimeout(() => {
        const { discard, tsumoWin } = processCpuTurn(state);

        if (tsumoWin) {
          // TODO: CPU和了処理
          dispatch({ type: "START_REVIEW" });
        } else {
          dispatch({ type: "DISCARD_TILE", tileIndex: discard });
        }
        processingRef.current = false;
      }, CPU_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [state]);

  // ============================================================
  // 人間のターン開始時に自動ツモ
  // ============================================================
  useEffect(() => {
    if (state.phase !== "playing") return;
    if (state.isPaused) return;
    if (state.turn !== 0) return;

    const humanPlayer = state.players[0];
    if (humanPlayer.drawnTile === null && state.wall.length > 0) {
      dispatch({ type: "DRAW_TILE" });
    }
  }, [state.turn, state.phase, state.isPaused]);

  // 山切れチェック
  useEffect(() => {
    if (state.phase === "playing" && state.wall.length === 0) {
      const allHands = state.players.map((p) => p.hand);
      // TODO: 流局処理
    }
  }, [state.wall.length, state.phase]);

  return {
    state,
    startGame,
    discardTile,
    pause,
    resume,
    goToReview,
    nextRound,
    isHumanTurn: state.turn === 0 && state.phase === "playing",
    canDiscard:
      state.turn === 0 &&
      state.phase === "playing" &&
      !state.isPaused &&
      state.players[0].drawnTile !== null,
  };
}
