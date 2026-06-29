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

function ScreenBody({ screen }: { screen: MockScreen }) {
  if (screen.key === 'home') {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-blue-600 p-3 text-white">
          <p className="text-[11px] font-bold">今日の状態</p>
          <p className="mt-1 text-lg font-black">{screen.rows[0] ?? 'サマリー'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {screen.rows.slice(1, 5).map((row) => (
            <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
              <p className="text-[11px] font-bold">{row}</p>
              <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">確認できます</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (screen.key === 'detail') {
    return (
      <div className="space-y-2">
        {screen.rows.map((row) => (
          <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{row}</p>
            <p className="mt-1 h-8 rounded bg-gray-100 text-[10px] dark:bg-gray-800" />
          </div>
        ))}
      </div>
    )
  }

  if (screen.key === 'create') {
    return (
      <div className="space-y-2">
        {screen.rows.map((row) => (
          <div key={row} className="rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
            <p className="text-[10px] font-bold text-gray-600 dark:text-gray-300">{row}</p>
            <div className="mt-1 h-7 rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800" />
          </div>
        ))}
        <div className="rounded-lg bg-gray-900 py-2 text-center text-[11px] font-black text-white dark:bg-blue-600">保存</div>
      </div>
    )
  }

  if (screen.key === 'mypage') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-gray-900">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gray-200 text-xs dark:bg-gray-800">me</span>
          <div>
            <p className="text-xs font-black">ユーザー</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">設定と履歴</p>
          </div>
        </div>
        {screen.rows.map((row) => (
          <div key={row} className="flex items-center justify-between rounded-lg bg-white p-2 text-[11px] font-bold shadow-sm dark:bg-gray-900">
            <span>{row}</span>
            <span className="text-gray-400">›</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {screen.rows.map((row, index) => (
        <div key={row} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm dark:bg-gray-900">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-black text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-bold">{row}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">タップして確認</p>
          </div>
        </div>
      ))}
    </div>
  )
}
