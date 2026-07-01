'use client'

import type { MockScreen } from '@/lib/app-proposals'

export default function MockPhone({ appName, screen, tabs }: { appName: string; screen: MockScreen; tabs: string[] }) {
  return (
    <div className="mx-auto w-[260px] rounded-[2rem] border border-gray-300 bg-gray-950 p-2 shadow-xl dark:border-gray-700">
      <div className="overflow-hidden rounded-[1.55rem] bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="flex h-6 items-center justify-between bg-gray-900 px-4 text-[10px] font-semibold text-white dark:bg-black">
          <span>9:41</span>
          <span className="h-1.5 w-14 rounded-full bg-white/80" />
          <span>5G</span>
        </div>
        <div className="border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900">
          <p className="truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">{appName}</p>
          <h3 className="truncate text-sm font-black">{screen.name}</h3>
        </div>
        <div className="min-h-[260px] bg-gray-100 p-3 dark:bg-gray-950">
          <ScreenBody screen={screen} />
        </div>
        <div className="grid grid-cols-5 border-t border-gray-200 bg-white px-1 py-2 dark:border-gray-800 dark:bg-gray-900">
          {tabs.slice(0, 5).map((tab) => (
            <span key={tab} className="truncate px-1 text-center text-[9px] font-semibold text-gray-500 dark:text-gray-400">
              {tab}
            </span>
          ))}
        </div>
        <div className="flex justify-center bg-white pb-2 dark:bg-gray-900">
          <span className="h-1 w-20 rounded-full bg-gray-900 dark:bg-gray-200" />
        </div>
      </div>
    </div>
  )
}

// 画面の key と名前から「見た目の種別」を判定する。key が汎用でも名前(日本語)で
// クイズ/盤面/結果/誘導/調査などを見分け、種別ごとに固有のレイアウトを描く。
function visualType(screen: MockScreen): string {
  const k = screen.key
  const n = screen.name ?? ''
  if (k === 'home') return 'home'
  if (k === 'detail') return 'detail'
  if (k === 'create' || /入力|記録|追加|フォーム/.test(n)) return 'form'
  if (k === 'mypage' || /マイページ|プロフィール|設定/.test(n)) return 'mypage'
  if (k === 'quiz' || k === 'test' || /クイズ|問題|テスト|一問|待ち牌|ドリル|回答/.test(n)) return 'quiz'
  if (k === 'board' || k === 'input' || /盤|牌|局面|河|手牌|駒|マップ|地図|経路/.test(n)) return 'board'
  if (k === 'result' || /結果|スコア|成績|解析|分析|評価|統計|グラフ/.test(n)) return 'result'
  if (k === 'guide' || /誘導|手順|ガイド|ステップ|なぞ/.test(n)) return 'guide'
  if (k === 'research' || k === 'tag' || /research|タグ|topic|トピック|検索|ニュース|記事|一覧/i.test(n)) return 'feed'
  return 'list'
}

function ScreenBody({ screen }: { screen: MockScreen }) {
  const rows = screen.rows.length > 0 ? screen.rows : ['項目']
  const type = visualType(screen)

  if (type === 'home') {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white">
          <p className="text-[11px] font-bold opacity-90">今日の状態</p>
          <p className="mt-1 text-lg font-black leading-tight">{rows[0]}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {rows.slice(1, 5).map((row) => (
            <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
              <span className="mb-1 block h-1.5 w-6 rounded-full bg-blue-500/70" />
              <p className="text-[11px] font-bold leading-tight">{row}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'quiz') {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Q. {rows[0]}</p>
          <div className="mt-2 flex justify-center gap-1">
            {[0, 1, 2].map((i) => <span key={i} className="h-6 w-5 rounded bg-white shadow-sm dark:bg-gray-800" />)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {['A', 'B', 'C', 'D'].map((c, i) => (
            <div key={c} className={`flex items-center gap-1.5 rounded-lg border p-2 ${i === 0 ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'}`}>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-gray-900 text-[9px] font-black text-white dark:bg-blue-600">{c}</span>
              <span className="truncate text-[10px] font-bold">{rows[i + 1] ?? '選択肢'}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'board') {
    return (
      <div className="space-y-2">
        <div className="rounded-lg bg-emerald-800 p-2">
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className="aspect-[3/4] rounded-sm bg-amber-50 shadow-sm" />
            ))}
          </div>
        </div>
        <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400">手元 / 盤面</p>
        <div className="flex justify-center gap-1">
          {rows.slice(0, 7).map((_, i) => (
            <span key={i} className="h-8 w-6 rounded bg-white shadow dark:bg-gray-800" />
          ))}
        </div>
      </div>
    )
  }

  if (type === 'result') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center rounded-xl bg-white py-3 shadow-sm dark:bg-gray-900">
          <div className="grid h-16 w-16 place-items-center rounded-full border-4 border-blue-500 text-center">
            <span className="text-lg font-black leading-none">82%</span>
          </div>
        </div>
        {rows.slice(0, 4).map((row, i) => (
          <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
            <p className="mb-1 text-[10px] font-bold">{row}</p>
            <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${90 - i * 18}%` }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'guide') {
    return (
      <div className="space-y-2">
        <div className="grid min-h-[120px] place-items-center rounded-xl bg-indigo-50 p-3 text-center dark:bg-indigo-900/20">
          <div>
            <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-sm font-black text-white">▶</span>
            <p className="text-[11px] font-bold text-indigo-800 dark:text-indigo-200">{rows[0]}</p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
          <span className="text-[11px] font-black text-gray-400">◀ 戻る</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === 1 ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'}`} />)}
          </div>
          <span className="text-[11px] font-black text-indigo-600">次へ ▶</span>
        </div>
      </div>
    )
  }

  if (type === 'feed') {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 overflow-hidden">
          {['#新着', '#人気', '#保存'].map((t) => (
            <span key={t} className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">{t}</span>
          ))}
        </div>
        {rows.slice(0, 4).map((row) => (
          <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
            <p className="text-[11px] font-bold leading-tight">{row}</p>
            <div className="mt-1 flex items-center gap-1">
              <span className="h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              <span className="text-[9px] text-gray-400">2分前</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'detail') {
    return (
      <div className="space-y-2">
        <div className="h-16 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700" />
        {rows.map((row) => (
          <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{row}</p>
            <div className="mt-1 h-6 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'form') {
    return (
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
            <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{row}</p>
            <div className="mt-1 h-7 rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800" />
          </div>
        ))}
        <div className="rounded-lg bg-gray-900 py-2 text-center text-[11px] font-black text-white dark:bg-blue-600">保存</div>
      </div>
    )
  }

  if (type === 'mypage') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-gray-900">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-pink-400 to-purple-500 text-xs font-black text-white">me</span>
          <div>
            <p className="text-xs font-black">ユーザー</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">設定と履歴</p>
          </div>
        </div>
        {rows.map((row) => (
          <div key={row} className="flex items-center justify-between rounded-lg bg-white p-2 text-[11px] font-bold shadow-sm dark:bg-gray-900">
            <span>{row}</span>
            <span className="text-gray-400">›</span>
          </div>
        ))}
      </div>
    )
  }

  // list
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold">{row}</p>
          </div>
          <span className="text-gray-300 dark:text-gray-600">›</span>
        </div>
      ))}
    </div>
  )
}
