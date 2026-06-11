export const dynamic = 'force-dynamic'

import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'
import { buildRevenueMilestones } from '@/lib/command-center'
import { readJson } from '@/lib/store'

// Revenue = 収益化専用ページ。経営指標だけを表示する。

interface MonetizationCandidateLite {
  name?: string
  status?: string
  score?: number
}

const stateStyle: Record<string, { icon: string; cls: string }> = {
  done: { icon: '✅', cls: 'text-gray-400 line-through' },
  current: { icon: '👉', cls: 'font-bold text-gray-900 dark:text-gray-100' },
  todo: { icon: '・', cls: 'text-gray-500 dark:text-gray-400' },
}

export default async function RevenuePage() {
  const milestones = await buildRevenueMilestones()
  const candidates = await readJson<MonetizationCandidateLite[]>('monetization-candidates.json', [])
  const candidateCount = candidates.length

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide title="Revenue" guide="収益化までの進捗を確認します。いま現実にいくら稼げているかと、次の一歩だけを表示します。" />

      <section className="rounded-xl border-2 border-emerald-200 bg-white p-5 text-center dark:border-emerald-900/50 dark:bg-gray-900">
        <p className="text-xs text-gray-400">現在の収益</p>
        <p className="mt-1 text-4xl font-bold text-gray-900 dark:text-gray-100">¥0</p>
        <p className="mt-2 text-[11px] text-gray-400">
          ストア・広告の収益データはまだ接続されていません。最初の収益が出たらここに反映します
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">収益1円までの道のり</h2>
        <ol className="mt-3 space-y-3">
          {milestones.map((m, i) => {
            const s = stateStyle[m.state]
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 text-base">{s.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm ${s.cls}`}>{m.label}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{m.note}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">控えているアプリ候補</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          収益化を狙えるアプリ候補が <span className="font-bold">{candidateCount}件</span> ストックされています。
          まずは1本目（BirdLog）を収益まで通すことを優先します。
        </p>
        <p className="mt-2 text-[11px] text-gray-400">
          候補の詳細管理は <Link href="/monetization" className="underline">Legacy → 収益化候補管理</Link>
        </p>
      </section>
    </div>
  )
}
