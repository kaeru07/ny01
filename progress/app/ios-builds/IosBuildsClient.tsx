'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PageGuide from '@/components/newux/PageGuide'
import SubTabBar from '@/components/navigation/SubTabBar'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'
import type { IosBuildsAppResponse, IosBuildsResponse, IosCodemagicBuild } from '@/types/ios-builds'

interface TriggerResponse {
  success: boolean
  buildId?: string | null
  error?: string
}

interface PickupResponse {
  success: boolean
  created?: Array<{ dir: string; title: string; approvalId: string }>
  updated?: Array<{ dir: string; title: string; approvalId: string }>
  skipped?: Array<{ dir: string; title: string; reason: string }>
  error?: string
}

const statusLabels: Record<string, string> = {
  finished: 'Finished',
  success: 'Success',
  successful: 'Success',
  building: 'Building',
  publishing: 'Publishing',
  queued: 'Queued',
  fetching: 'Fetching',
  preparing: 'Preparing',
  failed: 'Failed',
  canceled: 'Canceled',
  cancelled: 'Canceled',
  timeout: 'Timeout',
  timed_out: 'Timeout',
}

function statusClass(status: string | null): string {
  const key = (status ?? '').toLowerCase()
  if (['finished', 'success', 'successful', 'passed'].includes(key)) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
  if (['building', 'publishing', 'fetching', 'preparing'].includes(key)) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
  if (['failed', 'canceled', 'cancelled', 'timeout', 'timed_out'].includes(key)) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
}

function statusLabel(status: string | null): string {
  const key = (status ?? '').toLowerCase()
  return statusLabels[key] ?? status ?? 'Unknown'
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function shortHash(value: string | null): string {
  return value ? value.slice(0, 10) : '-'
}

function BuildRow({ build }: { build: IosCodemagicBuild }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-800">
      <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-black ${statusClass(build.status)}`}>
        {statusLabel(build.status)}
      </span>
      <div className="min-w-0 text-xs">
        <p className="truncate font-bold text-gray-900 dark:text-gray-100">
          {build.workflowId ?? 'workflow不明'} / {build.branch ?? 'branch不明'}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          完了 {formatDate(build.finishedAt)} / commit {shortHash(build.commitHash)}
        </p>
      </div>
    </li>
  )
}

function TestflightSection({ app }: { app: IosBuildsAppResponse }) {
  if (!app.testflight.available) {
    return (
      <p className="rounded-lg bg-gray-50 p-3 text-xs font-semibold leading-relaxed text-gray-600 dark:bg-gray-900 dark:text-gray-300">
        ASCキー未配置のため処理状況未確認（アップロード成否はビルドのPublishingで判断）
      </p>
    )
  }

  if (app.testflight.error) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        {app.testflight.error}
      </p>
    )
  }

  if (app.testflight.builds.length === 0) {
    return <p className="text-xs text-gray-500 dark:text-gray-400">TestFlightの直近ビルドは見つかりません。</p>
  }

  return (
    <ul className="space-y-1">
      {app.testflight.builds.map((build, index) => (
        <li key={`${build.version ?? 'v'}-${build.uploadedDate ?? index}`} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-gray-900 dark:text-gray-100">{build.version ?? 'version不明'}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {build.processingState ?? 'state不明'}
          </span>
          <span className="text-gray-500 dark:text-gray-400">{formatDate(build.uploadedDate)}</span>
        </li>
      ))}
    </ul>
  )
}

function AppCard({
  app,
  onTrigger,
  busy,
}: {
  app: IosBuildsAppResponse
  onTrigger: (app: IosBuildsAppResponse) => void
  busy: boolean
}) {
  return (
    <article className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black text-gray-900 dark:text-gray-100">{app.appName}</h2>
            {app.candidate.isCandidate ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                候補: {app.candidate.reason}
              </span>
            ) : null}
          </div>
          <p className="mt-1 break-all text-xs font-semibold text-gray-500 dark:text-gray-400">{app.bundleId ?? 'bundleId未設定'}</p>
          <p className="mt-0.5 break-all text-xs font-semibold text-gray-500 dark:text-gray-400">{app.repository ?? 'repository未設定'}</p>
        </div>
        <button
          type="button"
          onClick={() => onTrigger(app)}
          disabled={busy || Boolean(app.codemagicError)}
          className="min-h-10 rounded-lg bg-blue-600 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-blue-500 dark:disabled:bg-gray-700"
        >
          {busy ? '実行中' : 'ビルド実行'}
        </button>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">ローカル最新コミット</h3>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{app.localGit.subject ?? '取得できませんでした'}</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {shortHash(app.localGit.head)} / {formatDate(app.localGit.lastCommitAt)}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">直近ビルド</h3>
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            {app.workflowId ?? 'workflow未設定'} / {app.branch ?? 'branch未設定'}
          </span>
        </div>
        {app.codemagicError ? (
          <p className="rounded-lg bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            {app.codemagicError}
          </p>
        ) : app.builds.length > 0 ? (
          <ul className="rounded-lg bg-gray-50 px-3 dark:bg-gray-900">
            {app.builds.map((build, index) => (
              <BuildRow key={build.buildId ?? `${app.dir}-${index}`} build={build} />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">ビルド履歴はありません。</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">TestFlight</h3>
        <TestflightSection app={app} />
      </section>
    </article>
  )
}

export default function IosBuildsClient() {
  const [data, setData] = useState<IosBuildsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busyDir, setBusyDir] = useState<string | null>(null)
  const [pickupBusy, setPickupBusy] = useState(false)

  const candidateCount = useMemo(() => data?.apps.filter((app) => app.candidate.isCandidate).length ?? 0, [data])

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/ios-builds', { cache: 'no-store' })
      const json = await response.json() as IosBuildsResponse
      setData(json)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  async function trigger(app: IosBuildsAppResponse) {
    if (!window.confirm(`${app.appName} のCodemagicビルドを実行しますか？`)) return
    setBusyDir(app.dir)
    try {
      const response = await fetch('/api/ios-builds/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: app.dir }),
      })
      const json = await response.json() as TriggerResponse
      if (!json.success) throw new Error(json.error ?? 'ビルド起動に失敗しました')
      setToast(`ビルドを起動しました: ${json.buildId ?? 'buildId未取得'}`)
      await load()
    } catch (triggerError) {
      setToast(triggerError instanceof Error ? triggerError.message : 'ビルド起動に失敗しました')
    } finally {
      setBusyDir(null)
    }
  }

  async function pickup() {
    setPickupBusy(true)
    try {
      const response = await fetch('/api/ios-builds/pickup', { method: 'POST' })
      const json = await response.json() as PickupResponse
      if (!json.success) throw new Error(json.error ?? '候補作成に失敗しました')
      setToast(`今日の判断へ追加: ${json.created?.length ?? 0}件 / 更新: ${json.updated?.length ?? 0}件 / スキップ: ${json.skipped?.length ?? 0}件`)
      await load()
    } catch (pickupError) {
      setToast(pickupError instanceof Error ? pickupError.message : '候補作成に失敗しました')
    } finally {
      setPickupBusy(false)
    }
  }

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="iOSビルド"
        guide="Codemagicの直近ビルド、TestFlight処理状況、ローカル最新コミットとの差分から今日ビルドすべき候補を確認します。"
      />
      <SubTabBar items={APP_DEVELOPMENT_SUBTABS} />

      {toast ? (
        <div className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">
          {toast}
        </div>
      ) : null}

      {data && !data.codemagicReady ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100">
          <p className="font-black">Codemagicトークン未配置</p>
          <p className="mt-1 text-xs font-semibold">`/root/.secrets/appstore/codemagic.env` に `CODEMAGIC_API_TOKEN=...` を配置するとビルド状況を取得できます。</p>
        </section>
      ) : null}

      {data?.codemagicError ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100">
          {data.codemagicError}
        </section>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">ビルド候補</p>
          <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{candidateCount}件</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            最終更新 {formatDate(data?.generatedAt ?? null)}
          </p>
        </div>
        <button
          type="button"
          onClick={pickup}
          disabled={pickupBusy || candidateCount === 0}
          className="min-h-10 rounded-lg bg-amber-600 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-amber-500 dark:disabled:bg-gray-700"
        >
          {pickupBusy ? '作成中' : '候補を今日の判断へ'}
        </button>
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-100">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">読み込み中...</p>
      ) : null}

      <section className="space-y-4">
        {data?.apps.map((app) => (
          <AppCard key={app.dir} app={app} onTrigger={trigger} busy={busyDir === app.dir} />
        ))}
      </section>
    </main>
  )
}
