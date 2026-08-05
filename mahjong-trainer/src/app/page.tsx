"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useGame } from "@/application/game/useGame";
import { useTraining } from "@/application/training/useTraining";
import GameBoard from "@/components/game/GameBoard";
import GameControls from "@/components/game/GameControls";
import ReadingModal from "@/components/training/ReadingModal";
import ReviewPanel from "@/components/training/ReviewPanel";
import FeedbackTrainer from "@/components/ai/FeedbackTrainer";
import { PlayerIndex } from "@/types/mahjong";
import { playerLabel } from "@/engine/gameEngine";

export default function HomePage() {
  const { state, startGame, discardTile, pause, resume, goToReview, nextRound, canDiscard } =
    useGame();
  const [showFeedback, setShowFeedback] = useState(false);

  const {
    training,
    startReading,
    updateAttempt,
    submitAttempt,
    cancelReading,
    computeReviews,
    resetTraining,
  } = useTraining(state);

  // 読みモード開始時は対局を一時停止
  const handleStartReading = useCallback(
    (target: PlayerIndex) => {
      pause();
      startReading(target);
    },
    [pause, startReading]
  );

  // 読み提出後に再開
  const handleSubmitAttempt = useCallback(() => {
    submitAttempt();
    resume();
  }, [submitAttempt, resume]);

  // 読みキャンセル後に再開
  const handleCancelReading = useCallback(() => {
    cancelReading();
    resume();
  }, [cancelReading, resume]);

  // レビュー画面へ移行時に答え合わせを計算
  const handleGoToReview = useCallback(() => {
    computeReviews();
    goToReview();
  }, [computeReviews, goToReview]);

  // 次の局
  const handleNextRound = useCallback(() => {
    resetTraining();
    nextRound();
  }, [resetTraining, nextRound]);

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-gray-800 border-b border-gray-700 px-3 py-2 flex items-center justify-between">
        <h1 className="text-white font-bold text-sm">
          麻雀読みトレーナー
        </h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {state.phase === "playing" && (
            <>
              <span>
                東{state.round.number}局 {state.round.honba}本場
              </span>
              <span className="text-gray-600">|</span>
              <span>読み記録: {training.attempts.length}件</span>
            </>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2 p-2 min-h-0">
        {/* 対局エリア */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          {state.phase === "idle" ? (
            /* スタート画面 */
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">
                  麻雀読みトレーナー
                </h2>
                <p className="text-gray-400 text-sm max-w-xs">
                  実戦の中で相手の手牌を読む力を養うトレーニングアプリです。
                  対局中に任意のタイミングで読みを記録し、局後に答え合わせができます。
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 max-w-xs text-sm text-gray-300 space-y-2">
                <p className="font-semibold text-white">使い方</p>
                <p>1. 対局開始を押して始める</p>
                <p>2. 自分の番に手牌をクリックして打牌</p>
                <p>3. 「読む」ボタンでCPUの手牌を予想</p>
                <p>4. 局後に答え合わせを確認</p>
              </div>
              <button
                onClick={startGame}
                className="px-10 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-xl shadow-xl transition-all hover:scale-105"
              >
                対局開始
              </button>
              <button
                onClick={() => setShowFeedback(true)}
                className="px-6 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-lg text-sm shadow"
              >
                🎓 AI育成（フィードバック学習）
              </button>
            </div>
          ) : state.phase === "review" ? (
            /* レビュー画面 */
            <div className="flex-1 overflow-auto">
              <ReviewPanel
                attempts={training.attempts}
                results={training.reviewResults}
                onClose={handleNextRound}
              />
            </div>
          ) : (
            /* 対局中 */
            <>
              <div className="flex-1 min-h-0">
                <GameBoard
                  gameState={state}
                  canDiscard={canDiscard}
                  onDiscard={discardTile}
                />
              </div>

              {/* コントロール */}
              <div className="shrink-0">
                <GameControls
                  gameState={state}
                  onPause={pause}
                  onResume={resume}
                  onStartReading={handleStartReading}
                  onGoToReview={handleGoToReview}
                  onStartGame={startGame}
                  onNextRound={handleNextRound}
                />
              </div>
            </>
          )}
        </div>

        {/* サイドパネル: ゲームログ */}
        {state.phase === "playing" && (
          <div className="w-full lg:w-56 shrink-0">
            <GameLog log={state.gameLog} attempts={training.attempts.length} />
          </div>
        )}
      </div>

      {/* 読みモーダル */}
      {training.isReading &&
        training.selectedTarget !== null &&
        training.currentAttempt !== null && (
          <ReadingModal
            gameState={state}
            targetPlayer={training.selectedTarget}
            currentAttempt={training.currentAttempt}
            onUpdate={updateAttempt}
            onSubmit={handleSubmitAttempt}
            onCancel={handleCancelReading}
          />
        )}

      {/* AI育成（フィードバック学習）画面 */}
      {showFeedback && <FeedbackTrainer onClose={() => setShowFeedback(false)} />}

      {/* 一時停止オーバーレイ (読みモード以外の一時停止時) */}
      {state.isPaused && !training.isReading && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-gray-800 rounded-xl border border-gray-600 p-6 text-center shadow-2xl">
            <p className="text-white font-bold text-lg mb-1">⏸ 一時停止中</p>
            <p className="text-gray-400 text-sm mb-4">
              「読む」ボタンでCPUの手牌を予想できます
            </p>
            <div className="flex gap-2 flex-wrap justify-center mb-3">
              {([1, 2, 3] as PlayerIndex[]).map((idx) => (
                <button
                  key={idx}
                  onClick={() => handleStartReading(idx)}
                  className="px-3 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm rounded-lg"
                >
                  📖 {playerLabel(idx)}を読む
                </button>
              ))}
            </div>
            <button
              onClick={resume}
              className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg"
            >
              ▶ 再開
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ゲームログコンポーネント
function GameLog({
  log,
  attempts,
}: {
  log: string[];
  attempts: number;
}) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 h-full flex flex-col">
      <div className="p-2 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">ゲームログ</span>
        {attempts > 0 && (
          <span className="text-xs bg-purple-700 text-purple-200 px-1.5 rounded">
            読み {attempts}件
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {[...log].reverse().map((entry, i) => (
          <p key={i} className="text-xs text-gray-400">
            {entry}
          </p>
        ))}
      </div>
    </div>
  );
}
