"use client";

import { useState, useEffect, useCallback } from "react";
import TileComponent from "../game/TileComponent";
import { loadProfile, saveProfile, resetProfile, styleMeters, type PolicyProfile } from "@/ai/policy-store";
import { applyPreference, applyApproval, nudgeStyle, type StyleAxis } from "@/ai/feedback";
import { dealPracticeHand, suggestDiscard, type PracticeHand } from "@/ai/practice";
import { TileIndex } from "@/types/mahjong";

interface Props {
  onClose: () => void;
}

// UIからフィードバックしてAIのプレイスタイルを育てる画面。
// AIが提案した打牌に「良い/本当はこれ」で答えると重みが更新され永続化される。
export default function FeedbackTrainer({ onClose }: Props) {
  const [profile, setProfile] = useState<PolicyProfile | null>(null);
  const [hand, setHand] = useState<PracticeHand | null>(null);
  const [suggestion, setSuggestion] = useState<TileIndex | null>(null);
  const [picking, setPicking] = useState(false);
  const [flash, setFlash] = useState<string>("");

  const nextHand = useCallback((weights: number[]) => {
    const h = dealPracticeHand();
    setHand(h);
    setSuggestion(suggestDiscard(weights, h));
    setPicking(false);
  }, []);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    nextHand(p.weights);
  }, [nextHand]);

  if (!profile || !hand || suggestion === null) return null;

  const meters = styleMeters(profile.weights);

  function commit(weights: number[], msg: string) {
    const p: PolicyProfile = { weights, feedbackCount: profile!.feedbackCount + 1, updatedAt: Date.now() };
    saveProfile(p);
    setProfile(p);
    setFlash(msg);
    setTimeout(() => setFlash(""), 1400);
    nextHand(weights);
  }

  // 「この打牌で良い」→ 現状維持を弱く強化
  function approve() {
    const runnerUp = hand!.fullHand.find((t) => t !== suggestion);
    const w = applyApproval(profile!.weights, {
      fullHand: hand!.fullHand, doraIndicators: hand!.doraIndicators,
      chosen: suggestion!, runnerUp,
    });
    commit(w, "👍 このスタイルを強化しました");
  }

  // 「本当はこれを切る」→ 好みを学習
  function preferInstead(tile: TileIndex) {
    if (tile === suggestion) { setPicking(false); return; }
    const w = applyPreference(profile!.weights, {
      fullHand: hand!.fullHand, doraIndicators: hand!.doraIndicators,
      chosen: suggestion!, preferred: tile,
    });
    commit(w, "🎓 あなたの好みを学習しました");
  }

  function nudge(axis: StyleAxis, delta: number, label: string) {
    const w = nudgeStyle(profile!.weights, axis, delta);
    commit(w, `スタイル調整: ${label}`);
  }

  function reset() {
    const p = resetProfile();
    setProfile(p);
    setFlash("初期スタイルに戻しました");
    setTimeout(() => setFlash(""), 1400);
    nextHand(p.weights);
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 overflow-y-auto">
      <div className="max-w-md mx-auto p-4 pb-24">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-lg">🎓 AI育成（フィードバック学習）</h2>
          <button onClick={onClose} className="text-gray-400 text-sm px-2 py-1">閉じる</button>
        </div>

        <p className="text-gray-400 text-xs mb-3 leading-relaxed">
          AIの打牌提案に「良い / 本当はこれ」で答えると、その好みを学習して
          今後のAIのプレイスタイルに反映します（学習結果は端末に保存）。
        </p>

        {/* スタイルメーター */}
        <div className="bg-gray-800 rounded-lg p-3 mb-3 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-300 font-bold">現在のプレイスタイル</span>
            <span className="text-[10px] text-gray-500">学習 {profile.feedbackCount} 回</span>
          </div>
          {([
            ["スピード（テンパイ優先）", meters.speed],
            ["打点（ドラ重視）", meters.value],
            ["受けの広さ", meters.width],
            ["安全・整理", meters.tidiness],
          ] as [string, number][]).map(([label, v]) => (
            <div key={label} className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-gray-400 w-32 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${v}%` }} />
              </div>
              <span className="text-[10px] text-gray-400 w-7 text-right">{v}</span>
            </div>
          ))}
        </div>

        {/* 手牌 + AI提案 */}
        <div className="bg-green-900 rounded-lg p-3 mb-3 border border-green-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-green-300">この14枚から何を切る？</span>
            <span className="text-[10px] text-green-400">ドラ表示:
              <span className="inline-block align-middle ml-1">
                <TileComponent tileIndex={hand.doraIndicators[0]} size="sm" />
              </span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1 justify-center">
            {hand.fullHand.map((t, i) => {
              const isSuggested = t === suggestion && !picking;
              return (
                <button key={i} onClick={() => picking ? preferInstead(t) : undefined}
                  className={`relative rounded ${picking ? "ring-1 ring-yellow-400" : ""} ${isSuggested ? "-translate-y-1" : ""}`}>
                  <TileComponent tileIndex={t} size="md" highlighted={isSuggested} />
                  {isSuggested && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-orange-300 whitespace-nowrap">AI提案</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {flash && <p className="text-center text-green-400 text-sm mb-2">{flash}</p>}

        {/* フィードバック操作 */}
        {!picking ? (
          <div className="flex gap-2 mb-4">
            <button onClick={approve} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg">
              👍 この打牌で良い
            </button>
            <button onClick={() => setPicking(true)} className="flex-1 py-3 bg-purple-700 hover:bg-purple-600 text-white font-bold rounded-lg">
              ✍️ 本当はこれを切る
            </button>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-yellow-300 text-sm text-center mb-2">切るべき牌をタップしてください</p>
            <button onClick={() => setPicking(false)} className="w-full py-2 bg-gray-700 text-gray-300 rounded-lg text-sm">やめる</button>
          </div>
        )}

        {/* 粗いスタイル調整 */}
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <span className="text-xs text-gray-300 font-bold block mb-2">スタイルを直接調整</span>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => nudge("speed", 0.8, "スピード↑")} className="py-2 text-xs bg-gray-700 text-gray-200 rounded">スピード ↑</button>
            <button onClick={() => nudge("speed", -0.8, "スピード↓")} className="py-2 text-xs bg-gray-700 text-gray-200 rounded">スピード ↓</button>
            <button onClick={() => nudge("value", 0.8, "打点↑")} className="py-2 text-xs bg-gray-700 text-gray-200 rounded">打点(ドラ) ↑</button>
            <button onClick={() => nudge("tidiness", 0.8, "安全↑")} className="py-2 text-xs bg-gray-700 text-gray-200 rounded">安全・整理 ↑</button>
          </div>
          <button onClick={reset} className="w-full mt-2 py-2 text-xs text-gray-400 border border-gray-600 rounded">スタイルを初期化</button>
        </div>

        <div className="flex justify-center mt-3">
          <button onClick={() => nextHand(profile.weights)} className="text-xs text-gray-400 px-4 py-2">別の手牌でもう一度 →</button>
        </div>
      </div>
    </div>
  );
}
