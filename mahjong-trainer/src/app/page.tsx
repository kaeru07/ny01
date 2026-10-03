"use client";

import React, { useCallback, useState } from "react";
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
  const [openHands, setOpenHands] = useState(false);

  const {
    training,
    startReading,
    updateAttempt,
    submitAttempt,
    cancelReading,
    computeReviews,
    resetTraining,
  } = useTraining(state);

  const handleStartReading = useCallback(
    (target: PlayerIndex) => {
      pause();
      startReading(target);
    },
    [pause, startReading]
  );

  const handleSubmitAttempt = useCallback(() => {
    submitAttempt();
    resume();
  }, [submitAttempt, resume]);

  const handleCancelReading = useCallback(() => {
    cancelReading();
    resume();
  }, [cancelReading, resume]);

  const handleGoToReview = useCallback(() => {
    computeReviews();
    goToReview();
  }, [computeReviews, goToReview]);

  const handleNextRound = useCallback(() => {
    setOpenHands(false);
    resetTraining();
    nextRound();
  }, [resetTraining, nextRound]);

  const controls = (
    <GameControls
      gameState={state}
      onPause={pause}
      onResume={resume}
      onStartReading={handleStartReading}
      onGoToReview={handleGoToReview}
      onStartGame={startGame}
      onNextRound={handleNextRound}
      openHands={openHands}
      onToggleOpenHands={() => setOpenHands((value) => !value)}
    />
  );

  return (
    <main className="app-shell">
      {state.phase === "idle" ? (
        <div className="start-screen">
          <div className="start-screen-copy">
            <span className="start-screen-kicker">READ THE TABLE</span>
            <h1>麻雀解析トレーナー</h1>
            <p>
              実戦の流れを止めずに、河・立直・手出しから相手の待ちを読む練習をします。
            </p>
          </div>
          <div className="start-screen-actions">
            {controls}
            <button onClick={() => setShowFeedback(true)} className="feedback-control-button">
              AI育成・フィードバック
            </button>
          </div>
        </div>
      ) : state.phase === "review" ? (
        <div className="review-screen">
          <ReviewPanel
            attempts={training.attempts}
            results={training.reviewResults}
            onClose={handleNextRound}
          />
        </div>
      ) : (
        <GameBoard
          gameState={state}
          canDiscard={canDiscard}
          onDiscard={discardTile}
          controls={controls}
          openHands={openHands}
        />
      )}

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

      {showFeedback && <FeedbackTrainer onClose={() => setShowFeedback(false)} />}

      {state.isPaused && !training.isReading && state.phase === "playing" && (
        <div className="pause-actions">
          <div className="pause-actions-card">
            <p>停止中に相手を選んで読みを記録できます</p>
            <div className="pause-reading-buttons">
              {([1, 2, 3] as PlayerIndex[]).map((idx) => (
                <button key={idx} onClick={() => handleStartReading(idx)}>
                  {playerLabel(idx)}を読む
                </button>
              ))}
            </div>
            <button onClick={resume} className="pause-resume-button">再開</button>
          </div>
        </div>
      )}
    </main>
  );
}
