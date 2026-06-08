'use client'

import { useState } from 'react'

// 工場（AI工場オペレーションセンター）専用の使い方ガイド。
// 初見ユーザーが「続きから実行 / Codexへ引き継ぐ / 承認待ち / Claude上限時の動作」を理解するための説明導線。
const SECTIONS: { title: string; body: string }[] = [
  {
    title: '工場とは',
    body: `AI作業を管理するページです。

ClaudeやCodexが行った作業履歴、
承認待ち、
次にやる作業を確認できます。`,
  },
  {
    title: '普段の流れ',
    body: `Epicを開く
↓
AIに作業させる
↓
結果レビュー
↓
承認
↓
次の作業へ進む`,
  },
  {
    title: '続きから実行',
    body: `【用途】
・昨日の続きをやりたい
・前回のEpicを再開したい
・Claudeに続きを頼みたい

前回の作業内容をまとめて、
Claudeへ渡す指示文を作ります。`,
  },
  {
    title: 'Codexへ引き継ぐ',
    body: `【用途】
・Claude上限
・Codexで続きをやりたい

Codex向けの引き継ぎプロンプトを作ります。

※Codexは自動起動しません`,
  },
  {
    title: '承認待ち',
    body: `AIが作業を終えて、
人の確認を待っている状態です。

内容確認後
・承認
・却下
を選択します。`,
  },
  {
    title: 'よくあるケース',
    body: `Claude上限
↓
Codexへ引き継ぐ
↓
Codex作業
↓
結果レビュー
↓
承認`,
  },
]

interface Props {
  /** トリガーボタンの見た目。'icon' = ?丸ボタン / 'text' = ラベル付きボタン。 */
  variant?: 'icon' | 'text'
}

export default function FactoryGuideModal({ variant = 'text' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="工場の使い方を開く"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          ?
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          <span aria-hidden>?</span> 工場の使い方
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-3xl bg-white shadow-xl dark:bg-gray-900 sm:max-w-lg sm:rounded-2xl">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 pb-3 pt-5 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">工場の使い方</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-gray-400 transition-colors hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-700"
              >
                ×
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {SECTIONS.map((s) => (
                <section key={s.title}>
                  <h3 className="mb-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">{s.title}</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-400">{s.body}</p>
                </section>
              ))}
            </div>
            <div className="flex-shrink-0 px-5 pb-6 pt-3">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
