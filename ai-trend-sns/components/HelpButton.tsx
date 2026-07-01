'use client'

import { useState } from 'react'

export default function HelpButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="使い方を開く"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-white text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-100 hover:text-ink"
      >
        ?
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="使い方を閉じる"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-600">使い方</p>
                <h2 className="mt-1 text-xl font-bold text-ink">AIトレンドSNS運用の流れ</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-200"
              >
                閉じる
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <HelpStep
                number="1"
                title="Newsでニュースを登録"
                body="title、sourceUrl、summary、category、importance、memoを入れます。memoには「個人開発者にどう関係するか」を残すと、投稿案が使いやすくなります。"
              />
              <HelpStep
                number="2"
                title="Ideasで投稿案を生成"
                body="登録したニュースを元に、X投稿案、YouTube Shorts台本、note記事案を作ります。生成結果はdata/ideas.jsonに保存されます。"
              />
              <HelpStep
                number="3"
                title="コピーして投稿"
                body="Ideasの各カードにあるコピーボタンから投稿文をコピーします。外部APIでの自動投稿はまだ実装していません。"
              />
              <HelpStep
                number="4"
                title="Postsで投稿結果を記録"
                body="投稿後にimpressions、likes、bookmarks、replies、followsを手入力します。投稿ログはdata/posts.jsonに保存されます。"
              />
              <HelpStep
                number="5"
                title="Reportで週次振り返り"
                body="伸びた投稿TOP10、伸びたカテゴリ、次週やるテーマを確認します。反応が良いカテゴリを次の投稿テーマに使います。"
              />
            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-ink">最短ルート</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                まずは <span className="font-semibold">News</span> で1件登録 → <span className="font-semibold">Ideas</span> で生成 → コピーボタンで投稿文をコピー、の順に使ってください。
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function HelpStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
      </div>
    </div>
  )
}
