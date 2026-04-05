"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { TrainingState, ReadAttempt, ReviewResult } from "@/types/training";
import { PlayerIndex, TileIndex } from "@/types/mahjong";
import { GameState } from "@/types/game";
import { computeReviewResult } from "@/domain/training/scoring";

const initialTrainingState: TrainingState = {
  isReading: false,
  selectedTarget: null,
  currentAttempt: null,
  attempts: [],
  reviewResults: [],
};

export function useTraining(gameState: GameState) {
  const [training, setTraining] = useState<TrainingState>(initialTrainingState);

  // 読みモード開始: 対象プレイヤーを選択してモーダルを開く
  const startReading = useCallback((targetPlayer: PlayerIndex) => {
    setTraining((prev) => ({
      ...prev,
      isReading: true,
      selectedTarget: targetPlayer,
      currentAttempt: {
        id: uuidv4(),
        targetPlayer,
        turnCount: gameState.round.turnCount,
        handStyleTags: [],
        tileRangePrediction: [],
        rolePrediction: [],
        waitPrediction: [],
        freeNote: "",
        submittedAt: 0,
      },
    }));
  }, [gameState.round.turnCount]);

  // 読み回答を更新
  const updateAttempt = useCallback(
    (updates: Partial<ReadAttempt>) => {
      setTraining((prev) => ({
        ...prev,
        currentAttempt: prev.currentAttempt
          ? { ...prev.currentAttempt, ...updates }
          : null,
      }));
    },
    []
  );

  // 読み回答を確定して記録
  const submitAttempt = useCallback(() => {
    setTraining((prev) => {
      if (!prev.currentAttempt) return prev;
      const completed: ReadAttempt = {
        ...(prev.currentAttempt as ReadAttempt),
        submittedAt: Date.now(),
      };
      return {
        ...prev,
        isReading: false,
        selectedTarget: null,
        currentAttempt: null,
        attempts: [...prev.attempts, completed],
      };
    });
  }, []);

  // 読みモードをキャンセル
  const cancelReading = useCallback(() => {
    setTraining((prev) => ({
      ...prev,
      isReading: false,
      selectedTarget: null,
      currentAttempt: null,
    }));
  }, []);

  // 局後の答え合わせを計算
  const computeReviews = useCallback(() => {
    const results: ReviewResult[] = training.attempts.map((attempt) => {
      const target = gameState.players[attempt.targetPlayer];
      const actualHand = [...target.hand, ...(target.drawnTile ? [target.drawnTile] : [])];
      return computeReviewResult(attempt, actualHand);
    });
    setTraining((prev) => ({ ...prev, reviewResults: results }));
    return results;
  }, [training.attempts, gameState.players]);

  // トレーニング状態をリセット (次の局)
  const resetTraining = useCallback(() => {
    setTraining(initialTrainingState);
  }, []);

  return {
    training,
    startReading,
    updateAttempt,
    submitAttempt,
    cancelReading,
    computeReviews,
    resetTraining,
  };
}
