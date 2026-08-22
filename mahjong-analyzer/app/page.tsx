// ========================================
// メインページ
// ========================================
// クライアントコンポーネントとして状態を管理する
// ロジックは lib/mahjong/ に集約されており
// このページは UI の組み立てのみを担当する
// ========================================

"use client";

import { useEffect, useRef, useState } from "react";
import { Tile } from "@/lib/mahjong/types";
import { analyzeHand } from "@/lib/mahjong/analyzer";
import type { AnalysisResult } from "@/lib/mahjong/types";
import { HandInput } from "@/components/HandInput";
import { AnalysisResultView } from "@/components/AnalysisResult";

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisRequestRef = useRef(0);
  const analysisFrameRef = useRef<number | null>(null);
  const lastAnalyzedTilesRef = useRef<Tile[] | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function updateConnectionStatus() {
      setIsOnline(navigator.onLine);
    }

    updateConnectionStatus();
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);

    return () => {
      window.removeEventListener("online", updateConnectionStatus);
      window.removeEventListener("offline", updateConnectionStatus);
    };
  }, []);

  useEffect(() => {
    if (!result) return;

    // モバイルでは入力欄から結果が画面外になるため、解析完了後に結果の
    // 先頭へ移動する。preventScroll 非対応でも結果表示自体は継続できる。
    resultRef.current?.focus({ preventScroll: true });
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    resultRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [result]);

  useEffect(() => {
    return () => {
      if (analysisFrameRef.current !== null) {
        window.cancelAnimationFrame(analysisFrameRef.current);
      }
    };
  }, []);

  function handleAnalyze(tiles: Tile[]) {
    lastAnalyzedTilesRef.current = tiles;
    const requestId = ++analysisRequestRef.current;

    // サンプルの連打や復元処理の重複で次の描画前に再度呼ばれた場合は、
    // 古い解析を待機列から除き、常に最新の手牌だけを解析する。
    if (analysisFrameRef.current !== null) {
      window.cancelAnimationFrame(analysisFrameRef.current);
      analysisFrameRef.current = null;
    }

    setIsAnalyzing(true);
    // 再解析中に前回の結果を残すと、新しい入力の結果と誤認しやすい。
    // ロード状態へ切り替え、完了した解析結果だけを表示する。
    setResult(null);
    setError(null);

    // 先に処理中表示を描画してから解析し、連打による二重実行を防ぐ。
    analysisFrameRef.current = window.requestAnimationFrame(() => {
      analysisFrameRef.current = null;
      if (requestId !== analysisRequestRef.current) return;

      try {
        const r = analyzeHand(tiles);
        setResult(r);
      } catch (e) {
        setResult(null);
        setError("解析中にエラーが発生しました。手牌を確認してください。");
        console.error(e);
      } finally {
        if (requestId === analysisRequestRef.current) setIsAnalyzing(false);
      }
    });
  }

  function handleInvalidInput() {
    analysisRequestRef.current++;
    if (analysisFrameRef.current !== null) {
      window.cancelAnimationFrame(analysisFrameRef.current);
      analysisFrameRef.current = null;
    }
    setIsAnalyzing(false);
    setResult(null);
    setError(null);
  }

  function handleRetry() {
    const tiles = lastAnalyzedTilesRef.current;
    if (tiles) handleAnalyze(tiles);
  }

  return (
    <main
      className="app-safe-area max-w-2xl mx-auto px-4 space-y-6"
      aria-busy={isAnalyzing}
    >
      {/* ヘッダー */}
      <header className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
          🀄 麻雀解析AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          手牌を入力するとシャンテン数・有効牌・打牌候補を解析します
        </p>
      </header>

      {!isOnline && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          オフラインです。手牌解析はこのまま利用できます。
        </div>
      )}

      {/* 入力フォーム */}
      <HandInput
        onAnalyze={handleAnalyze}
        onInvalid={handleInvalidInput}
        onInputChange={handleInvalidInput}
        isAnalyzing={isAnalyzing}
      />

      {isAnalyzing && (
        <div
          role="status"
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
        >
          手牌を解析しています…
        </div>
      )}

      {/* 未解析時の空状態 */}
      {!isAnalyzing && !result && !error && (
        <section className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
          <h2 className="font-semibold text-gray-700">解析結果はここに表示されます</h2>
          <p className="mt-1 text-sm text-gray-500">
            13枚で有効牌、14枚で打牌候補と受け入れ枚数を確認できます。
          </p>
        </section>
      )}

      {/* システムエラー */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            もう一度解析する
          </button>
        </div>
      )}

      {/* 解析結果の更新をスクリーンリーダーにも通知する */}
      <div
        ref={resultRef}
        tabIndex={-1}
        aria-live="polite"
        aria-atomic="true"
        aria-busy={isAnalyzing}
        className="scroll-mt-4 focus:outline-none"
      >
        {result && <AnalysisResultView result={result} />}
      </div>

      {/* フッター */}
      <footer className="text-center text-xs text-gray-400 pb-4">
        v1.0 — 牌効率解析エンジン搭載
      </footer>
    </main>
  );
}
