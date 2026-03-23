// ========================================
// メインページ
// ========================================
// クライアントコンポーネントとして状態を管理する
// ロジックは lib/mahjong/ に集約されており
// このページは UI の組み立てのみを担当する
// ========================================

"use client";

import { useState } from "react";
import { Tile } from "@/lib/mahjong/types";
import { analyzeHand } from "@/lib/mahjong/analyzer";
import type { AnalysisResult } from "@/lib/mahjong/types";
import { HandInput } from "@/components/HandInput";
import { AnalysisResultView } from "@/components/AnalysisResult";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAnalyze(tiles: Tile[]) {
    try {
      const r = analyzeHand(tiles);
      setResult(r);
      setError(null);
    } catch (e) {
      setError("解析中にエラーが発生しました。手牌を確認してください。");
      console.error(e);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ヘッダー */}
      <header className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
          🀄 麻雀解析AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          手牌を入力するとシャンテン数・有効牌・打牌候補を解析します
        </p>
      </header>

      {/* 入力フォーム */}
      <HandInput onAnalyze={handleAnalyze} />

      {/* システムエラー */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 解析結果 */}
      {result && <AnalysisResultView result={result} />}

      {/* フッター */}
      <footer className="text-center text-xs text-gray-400 pb-4">
        v1.0 — 牌効率解析エンジン搭載
      </footer>
    </div>
  );
}
