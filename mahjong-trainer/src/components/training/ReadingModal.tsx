"use client";

import React, { useState, useCallback } from "react";
import { PlayerIndex, TileIndex } from "@/types/mahjong";
import { ReadAttempt, PREDICTABLE_ROLES, HAND_STYLES, HandStyleId } from "@/types/training";
import { GameState } from "@/types/game";
import TileComponent from "@/components/game/TileComponent";
import { tileName } from "@/domain/mahjong/tile";
import { playerLabel } from "@/engine/gameEngine";

interface ReadingModalProps {
  gameState: GameState;
  targetPlayer: PlayerIndex;
  currentAttempt: Partial<ReadAttempt>;
  onUpdate: (updates: Partial<ReadAttempt>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

// タブ型
type Tab = "waits" | "range" | "roles" | "note";

// 全34種の牌インデックス
const ALL_TILES = Array.from({ length: 34 }, (_, i) => i);

export default function ReadingModal({
  gameState,
  targetPlayer,
  currentAttempt,
  onUpdate,
  onSubmit,
  onCancel,
}: ReadingModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("waits");

  const target = gameState.players[targetPlayer];

  // 待ち牌選択のトグル
  const toggleWait = useCallback(
    (tile: TileIndex) => {
      const current = currentAttempt.waitPrediction ?? [];
      const next = current.includes(tile)
        ? current.filter((t) => t !== tile)
        : [...current, tile];
      onUpdate({ waitPrediction: next });
    },
    [currentAttempt.waitPrediction, onUpdate]
  );

  // 手牌スタイルタグのトグル
  const toggleStyle = useCallback(
    (styleId: HandStyleId) => {
      const current = (currentAttempt.handStyleTags ?? []) as HandStyleId[];
      const next = current.includes(styleId)
        ? current.filter((s) => s !== styleId)
        : [...current, styleId];
      onUpdate({ handStyleTags: next });
    },
    [currentAttempt.handStyleTags, onUpdate]
  );

  // 役選択のトグル
  const toggleRole = useCallback(
    (roleId: string) => {
      const current = currentAttempt.rolePrediction ?? [];
      const next = current.includes(roleId)
        ? current.filter((r) => r !== roleId)
        : [...current, roleId];
      onUpdate({ rolePrediction: next });
    },
    [currentAttempt.rolePrediction, onUpdate]
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
      <div className="bg-gray-900 rounded-xl border border-gray-600 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div>
            <h2 className="text-white font-bold text-base">
              読みトレーニング
            </h2>
            <p className="text-gray-400 text-xs">
              対象: {playerLabel(targetPlayer)} | 河: {target.discards.length}枚
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* 対象プレイヤーの河を参考表示 */}
        <div className="p-2 bg-gray-800 border-b border-gray-700">
          <p className="text-xs text-gray-400 mb-1">
            {playerLabel(targetPlayer)}の河:
          </p>
          <div className="flex flex-wrap gap-0.5">
            {target.discards.length === 0 ? (
              <span className="text-gray-500 text-xs italic">まだ捨てていない</span>
            ) : (
              target.discards.map((t, i) => (
                <TileComponent key={i} tileIndex={t} size="sm" />
              ))
            )}
          </div>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-700">
          {(
            [
              { id: "waits", label: "待ち予想" },
              { id: "range", label: "手牌レンジ" },
              { id: "roles", label: "役予想" },
              { id: "note", label: "メモ" },
            ] as { id: Tab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-purple-800 text-white border-b-2 border-purple-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === "waits" && (
            <TileSelector
              title="待ち牌と思う牌を選んでください"
              selected={currentAttempt.waitPrediction ?? []}
              onToggle={toggleWait}
            />
          )}

          {activeTab === "range" && (
            <HandStyleSelector
              selected={(currentAttempt.handStyleTags ?? []) as HandStyleId[]}
              onToggle={toggleStyle}
            />
          )}

          {activeTab === "roles" && (
            <div>
              <p className="text-xs text-gray-400 mb-2">
                有力と思う役を選んでください
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {PREDICTABLE_ROLES.map((role) => {
                  const selected = (currentAttempt.rolePrediction ?? []).includes(role.id);
                  return (
                    <button
                      key={role.id}
                      onClick={() => toggleRole(role.id)}
                      className={`py-2 px-3 rounded text-sm font-medium transition-colors ${
                        selected
                          ? "bg-purple-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {selected ? "✓ " : ""}{role.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "note" && (
            <div>
              <p className="text-xs text-gray-400 mb-2">自由メモ</p>
              <textarea
                className="w-full bg-gray-800 text-white border border-gray-600 rounded p-2 text-sm resize-none"
                rows={6}
                placeholder="気になった点、読みの根拠など自由に記録..."
                value={currentAttempt.freeNote ?? ""}
                onChange={(e) => onUpdate({ freeNote: e.target.value })}
              />
            </div>
          )}
        </div>

        {/* フッター: 現在の入力サマリー */}
        <div className="p-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
          待ち: {(currentAttempt.waitPrediction ?? []).length}枚 |{" "}
          スタイル: {(currentAttempt.handStyleTags ?? []).length}個 |{" "}
          役: {(currentAttempt.rolePrediction ?? []).length}個
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2 p-3 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold transition-colors"
          >
            読みを記録
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ============================================================
// 手牌スタイルタグ選択コンポーネント
// ============================================================
function HandStyleSelector({
  selected,
  onToggle,
}: {
  selected: HandStyleId[];
  onToggle: (id: HandStyleId) => void;
}) {
  const selectedSet = new Set(selected);
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">
        相手の手牌の傾向をすべて選んでください（複数可）
      </p>
      <div className="grid grid-cols-2 gap-2">
        {HAND_STYLES.map((style) => {
          const on = selectedSet.has(style.id);
          return (
            <button
              key={style.id}
              onClick={() => onToggle(style.id)}
              className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left active:scale-95 ${
                on
                  ? "bg-purple-700 border-purple-400 text-white shadow-md"
                  : "bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400"
              }`}
            >
              <span className="font-bold text-sm leading-tight">
                {on ? "✓ " : ""}{style.label}
              </span>
              <span className={`text-xs mt-0.5 leading-tight ${on ? "text-purple-200" : "text-gray-500"}`}>
                {style.desc}
              </span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 p-2 bg-purple-900/30 border border-purple-700 rounded-lg">
          <p className="text-xs text-purple-300">
            選択中: {selected.map(id => HAND_STYLES.find(s => s.id === id)?.label).join(" / ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 牌選択グリッドコンポーネント
// ============================================================
function TileSelector({
  title,
  selected,
  onToggle,
}: {
  title: string;
  selected: TileIndex[];
  onToggle: (t: TileIndex) => void;
}) {
  const selectedSet = new Set(selected);

  // スート別にグループ化
  const groups = [
    { label: "萬子", tiles: Array.from({ length: 9 }, (_, i) => i) },
    { label: "筒子", tiles: Array.from({ length: 9 }, (_, i) => i + 9) },
    { label: "索子", tiles: Array.from({ length: 9 }, (_, i) => i + 18) },
    { label: "字牌", tiles: Array.from({ length: 7 }, (_, i) => i + 27) },
  ];

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">{title}</p>
      {groups.map((g) => (
        <div key={g.label} className="mb-3">
          <p className="text-xs text-gray-500 mb-1">{g.label}</p>
          <div className="flex flex-wrap gap-1">
            {g.tiles.map((t) => (
              <div
                key={t}
                onClick={() => onToggle(t)}
                className={`cursor-pointer rounded border-2 transition-all ${
                  selectedSet.has(t)
                    ? "border-purple-400 ring-2 ring-purple-500"
                    : "border-transparent"
                }`}
              >
                <TileComponent tileIndex={t} size="sm" selected={selectedSet.has(t)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
