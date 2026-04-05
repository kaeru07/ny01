"use client";

import React, { useState } from "react";
import { ReviewResult, ReadAttempt, HAND_STYLES, ReviewGrade } from "@/types/training";
import TileComponent from "@/components/game/TileComponent";
import { playerLabel } from "@/engine/gameEngine";

interface ReviewPanelProps {
  attempts: ReadAttempt[];
  results: ReviewResult[];
  onClose: () => void; // 次局へ
}

// ─── グレードバッジ ──────────────────────────────────────────
const GRADE_CONFIG: Record<ReviewGrade, { label: string; bg: string; text: string; border: string }> = {
  hit:   { label: "当たり ✅", bg: "bg-green-800",  text: "text-green-200",  border: "border-green-500" },
  close: { label: "近い  🔸", bg: "bg-yellow-800", text: "text-yellow-200", border: "border-yellow-500" },
  miss:  { label: "外れ  ❌", bg: "bg-red-900",    text: "text-red-200",    border: "border-red-600" },
};

function GradeBadge({ grade }: { grade: ReviewGrade }) {
  const cfg = GRADE_CONFIG[grade];
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

// ─── スコアバー ──────────────────────────────────────────────
function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 45 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-7 text-right shrink-0">{value}</span>
    </div>
  );
}

// ─── 待ち比較行 ──────────────────────────────────────────────
function WaitRow({
  label,
  tiles,
  correct,
  wrong,
  missed,
}: {
  label: string;
  tiles: number[];
  correct?: number[];
  wrong?: number[];
  missed?: number[];
}) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-xs text-gray-400 w-12 shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1 flex-1">
        {tiles.length === 0 ? (
          <span className="text-xs text-gray-500 italic">なし</span>
        ) : (
          tiles.map((t, i) => (
            <div key={i} className="relative">
              <TileComponent tileIndex={t} size="sm" />
              {correct?.includes(t) && (
                <span className="absolute -top-1 -right-1 text-green-400 text-xs font-bold leading-none">✓</span>
              )}
              {wrong?.includes(t) && (
                <span className="absolute -top-1 -right-1 text-red-400 text-xs font-bold leading-none">✗</span>
              )}
            </div>
          ))
        )}
        {missed && missed.length > 0 && (
          <>
            <span className="text-gray-600 text-xs self-center">+見落とし:</span>
            {missed.map((t, i) => (
              <div key={`m${i}`} className="relative opacity-60">
                <TileComponent tileIndex={t} size="sm" />
                <span className="absolute -top-1 -right-1 text-orange-400 text-xs font-bold leading-none">?</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── 1件分のレビューカード ────────────────────────────────────
function ReviewCard({
  attempt,
  result,
}: {
  attempt: ReadAttempt;
  result: ReviewResult | undefined;
}) {
  const styles = (attempt.handStyleTags ?? []).map(
    id => HAND_STYLES.find(s => s.id === id)?.label ?? id
  );

  return (
    <div className="space-y-3">
      {/* ① グレード + 総合点 */}
      <div className="flex items-center justify-between bg-gray-800 rounded-xl p-3 border border-gray-700">
        <div>
          <p className="text-xs text-gray-400 mb-1">
            {playerLabel(attempt.targetPlayer)} / {attempt.turnCount}巡目
          </p>
          {result ? <GradeBadge grade={result.grade} /> : (
            <span className="text-gray-500 text-sm">採点データなし</span>
          )}
        </div>
        {result && (
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{result.scores.total}</p>
            <p className="text-xs text-gray-400">/ 100点</p>
          </div>
        )}
      </div>

      {/* ② 待ち牌 予想 vs 実際 */}
      <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 space-y-2">
        <h3 className="text-sm font-semibold text-white mb-2">待ち牌の答え合わせ</h3>
        <WaitRow
          label="予想"
          tiles={attempt.waitPrediction}
          correct={result?.comparison.correctWaits}
          wrong={result?.comparison.wrongWaits}
        />
        <WaitRow
          label="実際"
          tiles={result?.actualWaits ?? []}
          correct={result?.comparison.correctWaits}
          missed={result?.comparison.missedWaits}
        />
      </div>

      {/* ③ 実際の手牌 + 役傾向ヒント */}
      {result && (
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">{playerLabel(result.targetPlayer)}の手牌</h3>
            <div className="flex gap-1 flex-wrap justify-end">
              {result.yakuHints.map((h, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 bg-green-900 text-green-300 rounded border border-green-700">
                  {h}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-0.5">
            {result.actualHand.map((t, i) => (
              <TileComponent key={i} tileIndex={t} size="sm" />
            ))}
          </div>
        </div>
      )}

      {/* ④ スタイル予想 */}
      {styles.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <h3 className="text-xs text-gray-400 mb-1.5">スタイル予想</h3>
          <div className="flex flex-wrap gap-1.5">
            {styles.map((s, i) => (
              <span key={i} className="px-2 py-1 bg-purple-900 text-purple-200 text-xs rounded-full border border-purple-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ⑤ スコア詳細 */}
      {result && (
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 space-y-1.5">
          <h3 className="text-xs text-gray-400 mb-2">スコア詳細</h3>
          <ScoreBar label="待ち予想" value={result.scores.waitScore} />
          <ScoreBar label="スタイル" value={result.scores.styleScore} />
          <ScoreBar label="役予想"   value={result.scores.roleScore} />
        </div>
      )}

      {/* ⑥ フィードバック */}
      {result && result.feedback.length > 0 && (
        <div className="bg-blue-950 rounded-xl p-3 border border-blue-800">
          <h3 className="text-xs text-blue-300 font-semibold mb-1">フィードバック</h3>
          <ul className="space-y-0.5">
            {result.feedback.map((msg, i) => (
              <li key={i} className="text-xs text-gray-300">• {msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ⑦ 自由メモ */}
      {attempt.freeNote && (
        <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
          <h3 className="text-xs text-gray-400 mb-1">メモ</h3>
          <p className="text-xs text-gray-300 whitespace-pre-wrap">{attempt.freeNote}</p>
        </div>
      )}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────
export default function ReviewPanel({ attempts, results, onClose }: ReviewPanelProps) {
  const [idx, setIdx] = useState(0);

  // 読みなしの場合
  if (attempts.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 text-center mx-auto max-w-md">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-white font-semibold mb-1">この局は読みを記録しませんでした</p>
        <p className="text-gray-400 text-sm mb-4">
          対局中に「⏸ 停止」→「読む」ボタンで<br/>相手の手牌を予想できます。
        </p>
        <button
          onClick={onClose}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold rounded-xl shadow-lg transition-all"
        >
          次局へ →
        </button>
      </div>
    );
  }

  const attempt = attempts[idx];
  const result = results[idx];
  const total = attempts.length;

  return (
    <div className="flex flex-col min-h-full">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-3 py-2 flex items-center justify-between">
        <h2 className="text-white font-bold text-sm">答え合わせ</h2>
        <div className="flex items-center gap-2">
          {total > 1 && (
            <span className="text-xs text-gray-400">
              {idx + 1} / {total}件
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xs font-bold rounded-lg transition-all"
          >
            次局へ →
          </button>
        </div>
      </div>

      {/* 複数回答タブ */}
      {total > 1 && (
        <div className="flex gap-1 px-2 py-1.5 bg-gray-800 border-b border-gray-700 overflow-x-auto">
          {attempts.map((a, i) => {
            const r = results[i];
            const grade = r?.grade;
            const dot = grade === 'hit' ? '🟢' : grade === 'close' ? '🟡' : '🔴';
            return (
              <button
                key={a.id}
                onClick={() => setIdx(i)}
                className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-all ${
                  i === idx
                    ? "bg-purple-700 text-white font-semibold"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {dot} {playerLabel(a.targetPlayer)} ({a.turnCount}巡)
              </button>
            );
          })}
        </div>
      )}

      {/* カードコンテンツ */}
      <div className="flex-1 overflow-y-auto p-3">
        <ReviewCard attempt={attempt} result={result} />
      </div>

      {/* フッター ナビゲーション */}
      {total > 1 && (
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 flex items-center justify-between px-3 py-2">
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-sm rounded-lg transition-all"
          >
            ← 前へ
          </button>
          <span className="text-xs text-gray-500">{idx + 1} / {total}</span>
          <button
            onClick={() => setIdx(i => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-sm rounded-lg transition-all"
          >
            次へ →
          </button>
        </div>
      )}
    </div>
  );
}
