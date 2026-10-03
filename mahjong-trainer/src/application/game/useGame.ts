"use client";

import { useReducer, useEffect, useCallback, useRef } from "react";
import { GameState } from "@/types/game";
import { TileIndex, PlayerIndex } from "@/types/mahjong";
import {
  gameReducer,
  createInitialState,
  getHumanCallOptions,
  canDeclareRiichi,
  canRiichiWithDiscard,
} from "@/engine/gameEngine";
import { processCpuTurn, cpuSelectDiscard } from "@/engine/cpuPlayer";
import { cpuTurnWithPolicy } from "@/ai/live-agent";
import { loadProfile } from "@/ai/policy-store";
import { isTenpai } from "@/domain/mahjong/shanten";

const CPU_DELAY_MS = 620;

function countTile(hand: TileIndex[], tile: TileIndex) {
  return hand.filter((value) => value === tile).length;
}

function chiOptions(hand: TileIndex[], tile: TileIndex): TileIndex[][] {
  if (tile >= 27) return [];
  const base = Math.floor(tile / 9) * 9;
  const candidates = [
    [tile - 2, tile - 1],
    [tile - 1, tile + 1],
    [tile + 1, tile + 2],
  ];
  return candidates.filter((pair) => {
    if (pair.some((t) => t < base || t >= base + 9)) return false;
    const copy = [...hand];
    for (const t of pair) {
      const i = copy.indexOf(t);
      if (i < 0) return false;
      copy.splice(i, 1);
    }
    return true;
  });
}

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, createInitialState());
  const processingRef = useRef(false);
  const policyRef = useRef<number[] | null>(null);

  const cpuTurn = useCallback((s: GameState) => {
    if (policyRef.current === null) policyRef.current = loadProfile().weights;
    try {
      return cpuTurnWithPolicy(s, policyRef.current);
    } catch {
      return processCpuTurn(s);
    }
  }, []);

  const startGame = useCallback(() => {
    policyRef.current = null;
    dispatch({ type: "START_GAME" });
  }, []);

  const callOptions = getHumanCallOptions(state);
  const riichiAvailable = canDeclareRiichi(state, 0);

  const discardTile = useCallback(
    (tileIndex: TileIndex, fromDrawn = false) => {
      if (state.turn !== 0 || state.isPaused || state.phase !== "playing") return;
      if (state.players[0].riichi && !fromDrawn) return;
      if (state.riichiArmed) {
        if (!canRiichiWithDiscard(state, tileIndex, fromDrawn, 0)) return;
        dispatch({ type: "DECLARE_RIICHI", tileIndex, fromDrawn });
        return;
      }
      dispatch({ type: "DISCARD_TILE", tileIndex, fromDrawn });
    },
    [state]
  );

  const armRiichi = useCallback(() => {
    dispatch({ type: state.riichiArmed ? "CANCEL_RIICHI" : "ARM_RIICHI" });
  }, [state.riichiArmed]);

  const callMeld = useCallback(
    (meldType: "chi" | "pon" | "kan", tilesFromHand: TileIndex[]) => {
      dispatch({ type: "CALL_MELD", caller: 0, meldType, tilesFromHand });
    },
    []
  );
  const passCall = useCallback(() => dispatch({ type: "PASS_CALL" }), []);
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const resume = useCallback(() => dispatch({ type: "RESUME" }), []);
  const goToReview = useCallback(() => dispatch({ type: "START_REVIEW" }), []);
  const nextRound = useCallback(() => dispatch({ type: "NEXT_ROUND" }), []);

  useEffect(() => {
    if (state.phase !== "playing" || state.isPaused || processingRef.current) return;

    // Human has priority to claim an opponent discard before the next CPU proceeds.
    if (getHumanCallOptions(state)) return;
    if (state.turn === 0) return;

    const currentPlayer = state.players[state.turn];

    // Prototype-like CPU calls by the next seat. This is intentionally light-weight;
    // the existing trained discard policy remains the source of discard decisions.
    if (
      state.lastDiscard &&
      state.lastDiscard.player !== state.turn &&
      currentPlayer.drawnTile === null &&
      !currentPlayer.riichi &&
      currentPlayer.melds.length < 2
    ) {
      const calledTile = state.lastDiscard.tile;
      const count = countTile(currentPlayer.hand, calledTile);
      const isNextSeat = state.turn === (((state.lastDiscard.player + 1) % 4) as PlayerIndex);
      const chis = isNextSeat ? chiOptions(currentPlayer.hand, calledTile) : [];
      const roll = Math.random();

      if (count >= 3 && roll < 0.07) {
        processingRef.current = true;
        const timer = setTimeout(() => {
          dispatch({ type: "CALL_MELD", caller: state.turn, meldType: "kan", tilesFromHand: [calledTile, calledTile, calledTile] });
          processingRef.current = false;
        }, CPU_DELAY_MS / 2);
        return () => clearTimeout(timer);
      }
      if (count >= 2 && roll < 0.20) {
        processingRef.current = true;
        const timer = setTimeout(() => {
          dispatch({ type: "CALL_MELD", caller: state.turn, meldType: "pon", tilesFromHand: [calledTile, calledTile] });
          processingRef.current = false;
        }, CPU_DELAY_MS / 2);
        return () => clearTimeout(timer);
      }
      if (chis.length > 0 && roll < 0.34) {
        processingRef.current = true;
        const timer = setTimeout(() => {
          dispatch({ type: "CALL_MELD", caller: state.turn, meldType: "chi", tilesFromHand: chis[0] });
          processingRef.current = false;
        }, CPU_DELAY_MS / 2);
        return () => clearTimeout(timer);
      }
    }

    if (state.mustDiscard && currentPlayer.drawnTile === null) {
      processingRef.current = true;
      const timer = setTimeout(() => {
        const discard = cpuSelectDiscard(currentPlayer.hand, null);
        dispatch({ type: "DISCARD_TILE", tileIndex: discard, fromDrawn: false });
        processingRef.current = false;
      }, CPU_DELAY_MS);
      return () => clearTimeout(timer);
    }

    if (currentPlayer.drawnTile === null && state.wall.length > 0) {
      processingRef.current = true;
      const timer = setTimeout(() => {
        dispatch({ type: "DRAW_TILE" });
        processingRef.current = false;
      }, CPU_DELAY_MS / 2);
      return () => clearTimeout(timer);
    }

    if (currentPlayer.drawnTile !== null) {
      processingRef.current = true;
      const timer = setTimeout(() => {
        const { discard, tsumoWin } = cpuTurn(state);
        if (tsumoWin) {
          dispatch({ type: "START_REVIEW" });
        } else {
          const fromDrawn = discard === currentPlayer.drawnTile && !currentPlayer.hand.includes(discard);
          const fullHand = [...currentPlayer.hand, currentPlayer.drawnTile!];
          const discardIndex = fullHand.indexOf(discard);
          const remaining = discardIndex >= 0
            ? fullHand.filter((_, index) => index !== discardIndex)
            : currentPlayer.hand;
          const shouldRiichi =
            !currentPlayer.riichi &&
            currentPlayer.score >= 1000 &&
            currentPlayer.melds.length === 0 &&
            isTenpai(remaining) &&
            Math.random() < 0.32;

          dispatch({
            type: shouldRiichi ? "DECLARE_RIICHI" : "DISCARD_TILE",
            tileIndex: discard,
            fromDrawn,
          });
        }
        processingRef.current = false;
      }, CPU_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [state, cpuTurn]);

  useEffect(() => {
    if (state.phase !== "playing" || state.isPaused || state.turn !== 0) return;
    if (state.mustDiscard || getHumanCallOptions(state)) return;
    const humanPlayer = state.players[0];
    if (humanPlayer.drawnTile === null && state.wall.length > 0) dispatch({ type: "DRAW_TILE" });
  }, [state]);

  return {
    state,
    startGame,
    discardTile,
    pause,
    resume,
    goToReview,
    nextRound,
    armRiichi,
    callMeld,
    passCall,
    callOptions,
    canDeclareRiichi: riichiAvailable,
    isHumanTurn: state.turn === 0 && state.phase === "playing",
    canDiscard:
      state.turn === 0 &&
      state.phase === "playing" &&
      !state.isPaused &&
      (state.players[0].drawnTile !== null || state.mustDiscard),
  };
}
