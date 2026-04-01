"use client";

import React, { useState } from "react";
import { ReviewResult } from "@/types/training";
import { ReadAttempt } from "@/types/training";
import { PlayerIndex } from "@/types/mahjong";
import TileComponent from "@/components/game/TileComponent";
import { tileName } from "@/domain/mahjong/tile";
import { playerLabel } from "@/engine/gameEngine";

interface ReviewPanelProps {
  attempts: ReadAttempt[];
  results: ReviewResult[];
  onClose: () => void;
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white w-8 text-right">{value}点</span>
    </div>
  );
}

export default function ReviewPanel({
  attempts,
  results,
  onClose,
}: ReviewPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (attempts.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-600 p-6 text-center">
        <p className="text-gray-400 text-sm">この局では読みを記録しませんでした。</p>
        <p className="text-gray-500 text-xs mt-1">
          対局中に「読む」ボタンを押すと次回から記録できます。
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
        >
          閉じる
        </button>
      </div>
    );
  }

  const attempt = attempts[selectedIndex];
  const result = results[selectedIndex];

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-600 overflow-hidden max-h-[85vh] flex flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <h2 className="text-white font-bold">答え合わせ</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      {/* 読み回答セレクター */}
      {attempts.length > 1 && (
        <div className="flex gap-1 p-2 bg-gray-800 border-b border-gray-700 overflow-x-auto">
          {attempts.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setSelectedIndex(i)}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                i === selectedIndex
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {playerLabel(a.targetPlayer)} (巡{a.turnCount})
            </button>
          ))}
        </div>
      )}

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {result ? (
          <>
            {/* 総合スコア */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-white font-bold mb-2">
                総合点: {result.scores.total}点
              </h3>
              <div className="space-y-1.5">
                <div>
                  <span className="text-xs text-gray-400">待ち予想</span>
                  <ScoreBar value={result.scores.waitScore} />
                </div>
                <div>
                  <span className="text-xs text-gray-400">手牌レンジ</span>
                  <ScoreBar value={result.scores.rangeScore} />
                </div>
                <div>
                  <span className="text-xs text-gray-400">役予想</span>
                  <ScoreBar value={result.scores.roleScore} />
                </div>
              </div>
            </div>

            {/* フィードバック */}
            {result.feedback.length > 0 && (
              <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3">
                <h3 className="text-blue-300 font-semibold text-sm mb-1">
                  フィードバック
                </h3>
                <ul className="space-y-0.5">
                  {result.feedback.map((msg, i) => (
                    <li key={i} className="text-gray-300 text-xs">
                      • {msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 待ち比較 */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-white font-semibold text-sm mb-2">
                待ち牌の答え合わせ
              </h3>

              {/* 正解 */}
              <div className="mb-2">
                <span className="text-xs text-gray-400">実際の待ち: </span>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {result.actualWaits.length === 0 ? (
                    <span className="text-gray-500 text-xs italic">
                      テンパイなし
                    </span>
                  ) : (
                    result.actualWaits.map((t, i) => (
                      <TileComponent
                        key={i}
                        tileIndex={t}
                        size="sm"
                        highlighted={result.comparison.correctWaits.includes(t)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* 予想 */}
              <div className="mb-2">
                <span className="text-xs text-gray-400">あなたの予想: </span>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {attempt.waitPrediction.length === 0 ? (
                    <span className="text-gray-500 text-xs italic">なし</span>
                  ) : (
                    attempt.waitPrediction.map((t, i) => (
                      <div key={i} className="relative">
                        <TileComponent tileIndex={t} size="sm" />
                        {result.comparison.wrongWaits.includes(t) && (
                          <span className="absolute -top-1 -right-1 text-red-400 text-xs leading-none">
                            ✗
                          </span>
                        )}
                        {result.comparison.correctWaits.includes(t) && (
                          <span className="absolute -top-1 -right-1 text-green-400 text-xs leading-none">
                            ✓
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 見落とし */}
              {result.comparison.missedWaits.length > 0 && (
                <div className="p-2 bg-orange-900/40 border border-orange-700 rounded text-xs">
                  <span className="text-orange-300">見落とし: </span>
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {result.comparison.missedWaits.map((t, i) => (
                      <TileComponent key={i} tileIndex={t} size="sm" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 実際の手牌 */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-white font-semibold text-sm mb-2">
                {playerLabel(result.targetPlayer)}の手牌
              </h3>
              <div className="flex flex-wrap gap-0.5">
                {result.actualHand.map((t, i) => (
                  <TileComponent key={i} tileIndex={t} size="sm" />
                ))}
              </div>
            </div>

            {/* 自由メモ */}
            {attempt.freeNote && (
              <div className="bg-gray-800 rounded-lg p-3">
                <h3 className="text-gray-400 text-xs mb-1">あなたのメモ</h3>
                <p className="text-gray-300 text-sm whitespace-pre-wrap">
                  {attempt.freeNote}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-500 text-sm">
            答え合わせデータがありません
          </div>
        )}
      </div>
    </div>
  );
}
