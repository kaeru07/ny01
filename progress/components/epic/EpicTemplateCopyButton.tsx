'use client'

import { useEffect, useRef, useState } from 'react'
import { epicTemplateText } from '@/lib/epic-contract'

type CopyState = 'idle' | 'copied' | 'manual' | 'error'

// Epic JSON テンプレを ChatGPT / Claude / Codex に渡して埋めてもらう用にコピーする。
// コピー内容に入れ子コードブロック（```）は含めない（プロンプト貼り付け対応）。
//
// クリップボード処理はこのコンポーネント内に閉じる（共通 lib/clipboard.ts は
// 他画面が使っているためスコープ外＝変更しない）。
//
// 重要: 本アプリは HTTP（非 HTTPS）で配信されるため、iPhone Safari からは
// navigator.clipboard が無効になる。その状態で execCommand('copy') は true を
// 返しても実際にはコピーされないことがある（＝「コピーしました」と出るのに空）。
// そのため「信頼できる navigator.clipboard が成功したときだけ成功表示」とし、
// 使えない環境では本文を選択済み textarea で出して手動コピー導線を出す。
export default function EpicTemplateCopyButton() {
  const [state, setState] = useState<CopyState>('idle')
  const [manualText, setManualText] = useState('')
  const manualRef = useRef<HTMLTextAreaElement | null>(null)

  // 手動コピー欄を出したら、その場で全選択しておく（iPhone は「コピー」を押すだけ）。
  useEffect(() => {
    if (state === 'manual' && manualRef.current) {
      const ta = manualRef.current
      ta.focus()
      ta.setSelectionRange(0, ta.value.length)
      // iOS Safari 向けに execCommand も一応試す（成功すれば手動操作不要）。
      // ただし戻り値は信頼しないので成功表示には使わない。
      try {
        document.execCommand('copy')
      } catch {
        /* noop */
      }
    }
  }, [state])

  async function copy() {
    const text = epicTemplateText()

    // 1) 信頼できる経路: 非同期 Clipboard API（HTTPS / localhost のみ有効）
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        setState('copied')
        setTimeout(() => setState((s) => (s === 'copied' ? 'idle' : s)), 2500)
        return
      } catch {
        // 権限拒否など → 手動導線へ
      }
    }

    // 2) Clipboard API が使えない / 失敗 → 手動コピー欄を表示（確実な導線）
    if (typeof document === 'undefined') {
      setState('error')
      return
    }
    setManualText(text)
    setState('manual')
  }

  const isCopied = state === 'copied'
  const isManual = state === 'manual'
  const isError = state === 'error'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
          isCopied
            ? 'bg-green-600 text-white'
            : isError
              ? 'bg-red-600 text-white'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
        }`}
      >
        {isCopied
          ? '✓ コピーしました（ChatGPT/Claude/Codex に貼り付け）'
          : isError
            ? '⚠ コピーできませんでした'
            : '📋 Epic JSONテンプレをコピー'}
      </button>

      {isManual && (
        <div className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
            この環境（HTTP 接続）ではワンタップ自動コピーが使えません。下のテキストは{' '}
            <span className="font-semibold">選択済み</span>です。そのまま
            <span className="font-semibold">「コピー」</span>
            （iPhone はメニューの「コピー」をタップ）してください。
          </p>
          <textarea
            ref={manualRef}
            readOnly
            value={manualText}
            onFocus={(e) => e.currentTarget.setSelectionRange(0, e.currentTarget.value.length)}
            rows={6}
            className="w-full resize-y rounded-lg border border-amber-300 bg-white p-2 font-mono text-[16px] leading-snug text-gray-800 dark:border-amber-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => {
              const ta = manualRef.current
              if (!ta) return
              ta.focus()
              ta.setSelectionRange(0, ta.value.length)
            }}
            className="rounded-lg border border-amber-400 px-3 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            もう一度すべて選択
          </button>
        </div>
      )}

      {isError && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          コピーできませんでした。下の「JSONインポート」欄などにテンプレを表示して手動でコピーしてください。
        </p>
      )}
    </div>
  )
}
