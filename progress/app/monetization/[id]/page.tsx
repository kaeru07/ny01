export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCandidate } from '@/lib/monetization-store'
import { statusMeta, scoreColor, blueOceanMeta, levelMeta } from '@/lib/monetization-ui'
import ApprovalActions from '@/components/monetization/ApprovalActions'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value, cls }: { label: string; value?: string; cls?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-gray-400">{label}</span>
      <span className={`text-right font-medium ${cls ?? 'text-gray-700 dark:text-gray-200'}`}>{value}</span>
    </div>
  )
}

export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const c = await getCandidate(params.id)
  if (!c) notFound()

  const st = statusMeta(c.status)
  const bo = blueOceanMeta(c.blueOcean)
  const breakdown = c.scoreBreakdown
  const breakdownEntries: [string, number | undefined][] = breakdown
    ? [
        ['市場規模', breakdown.marketSize],
        ['収益化', breakdown.monetization],
        ['継続率', breakdown.retention],
        ['ASO', breakdown.aso],
        ['海外展開', breakdown.overseas],
        ['開発容易性', breakdown.devEase],
      ]
    : []
  const breakdownTotal = breakdownEntries.reduce((s, [, v]) => s + (v ?? 0), 0)

  return (
    <div className="space-y-3 px-4 pb-24 pt-4">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Link href="/monetization" className="hover:underline">収益化候補</Link>
        <span className="text-gray-300">/</span>
        <span className="truncate text-gray-500">{c.name}</span>
      </div>

      {/* 概要 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-lg font-bold leading-none ${scoreColor(c.score)}`}>
            {c.score}
            <span className="mt-0.5 text-[8px] font-medium opacity-80">score</span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{c.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">{c.category}</span>
              {bo && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${bo.cls}`}>{bo.emoji} {bo.label}</span>}
            </div>
            <div className="mt-2 text-[11px] text-gray-400">
              発見 {(c.discoveredAt ?? '').slice(0, 10)}
              {c.lastResearchedAt && ` / 最終調査 ${c.lastResearchedAt.slice(0, 10)}`}
              {` / 更新 ${(c.updatedAt ?? '').slice(0, 10)}`}
            </div>
          </div>
        </div>
      </section>

      {/* 承認フロー（保留/却下/再調査/Epic化） */}
      <ApprovalActions id={c.id} status={c.status} linkEpicId={c.links?.epicId} />

      {/* なぜ作るべきか */}
      {(c.whyNow || c.problem) && (
        <Section title="なぜ作るべきか">
          {c.whyNow?.summary && <p className="text-sm text-gray-700 dark:text-gray-200">{c.whyNow.summary}</p>}
          <div className="mt-2 space-y-1">
            <Row label="市場機会" value={c.whyNow?.marketOpportunity} />
            <Row label="タイミング" value={c.whyNow?.timing} />
          </div>
        </Section>
      )}

      {c.problem && (
        <Section title="解決する課題">
          <p className="text-sm text-gray-700 dark:text-gray-200">{c.problem}</p>
        </Section>
      )}

      {c.target && (
        <Section title="ターゲット">
          <p className="text-sm text-gray-700 dark:text-gray-200">{c.target}</p>
        </Section>
      )}

      {c.mvp && c.mvp.length > 0 && (
        <Section title="MVP案">
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-200">
            {c.mvp.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </Section>
      )}

      {c.monetization && (
        <Section title="収益化方法">
          <div className="flex flex-wrap gap-1.5">
            {c.monetization.ads && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-800">広告</span>}
            {c.monetization.subscription && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-800">サブスク</span>}
            {c.monetization.oneTime && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-800">買い切り</span>}
            {c.monetization.affiliate && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-800">アフィリエイト</span>}
          </div>
          {c.monetization.note && <p className="mt-2 text-xs text-gray-500">{c.monetization.note}</p>}
        </Section>
      )}

      {/* 市場調査 */}
      <Section title="市場調査">
        <Row label="推定市場規模" value={c.marketSize} />
        <Row label="推定ユーザー数" value={c.estimatedUsers} />
        <Row label="Google Trends" value={c.trendsRating} />
        <Row label="Play Store需要" value={c.playStoreDemand} />
        <Row label="期待収益" value={c.expectedRevenue} />
        <Row label="開発難易度" value={levelMeta(c.devDifficulty, true)?.label} cls={levelMeta(c.devDifficulty, true)?.cls} />
        <Row label="海外展開性" value={levelMeta(c.overseas)?.label} cls={levelMeta(c.overseas)?.cls} />
      </Section>

      {/* 検索需要 */}
      <Section title="検索需要">
        {c.keywords && c.keywords.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {c.keywords.map((k, i) => (
              <span key={i} className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">#{k}</span>
            ))}
          </div>
        )}
        <Row label="検索需要評価" value={levelMeta(c.demand)?.label} cls={levelMeta(c.demand)?.cls} />
        <Row label="SEO難易度" value={levelMeta(c.seoDifficulty, true)?.label} cls={levelMeta(c.seoDifficulty, true)?.cls} />
      </Section>

      {/* ブルーオーシャン判定 */}
      {(bo || c.blueOceanReason) && (
        <Section title="ブルーオーシャン判定">
          {bo && <p className="mb-2 text-2xl">{bo.emoji} <span className="align-middle text-sm font-semibold text-gray-700 dark:text-gray-200">{bo.label}</span></p>}
          {c.blueOceanReason && (
            <div className="space-y-1">
              <Row label="競合数" value={c.blueOceanReason.competitorCount} />
              <Row label="競合品質" value={c.blueOceanReason.competitorQuality} />
              <Row label="差別化余地" value={c.blueOceanReason.differentiation} />
              <Row label="参入障壁" value={c.blueOceanReason.barrier} />
            </div>
          )}
        </Section>
      )}

      {/* 競合分析 */}
      {c.competitors && c.competitors.length > 0 && (
        <Section title="競合分析">
          <div className="grid grid-cols-2 gap-2">
            {c.competitors.map((cp, i) => (
              <div key={i} className="rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{cp.name}</span>
                  <span className="text-xs text-gray-400">{[cp.rating && `★${cp.rating}`, cp.downloads].filter(Boolean).join(' / ')}</span>
                </div>
                {cp.strengths && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">強み: {cp.strengths}</p>}
                {cp.weaknesses && <p className="text-xs text-rose-600 dark:text-rose-400">弱み: {cp.weaknesses}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* スコア根拠 */}
      {breakdown && breakdownEntries.some(([, v]) => v != null) && (
        <Section title="スコア根拠">
          <div className="space-y-1">
            {breakdownEntries.map(([label, v]) =>
              v == null ? null : (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-gray-400">{label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, v)}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">{v}</span>
                </div>
              ),
            )}
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-sm font-bold dark:border-gray-800">
            <span className="text-gray-500">合計（参考）</span>
            <span className="text-gray-900 dark:text-gray-100">{breakdownTotal} / 総合スコア {c.score}</span>
          </div>
        </Section>
      )}

      {/* 調査元一覧（Vault 由来の根拠） */}
      {c.sourceRefs && c.sourceRefs.length > 0 && (
        <Section title={`調査元一覧（${c.sourceRefs.length}件）`}>
          <div className="grid grid-cols-2 gap-2">
            {c.sourceRefs.map((s) => (
              <div key={s.id} className="rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="break-all font-mono text-[11px] text-gray-700 dark:text-gray-200">{s.path}</span>
                  <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">{s.type}</span>
                </div>
                {s.section && <div className="mt-0.5 text-[11px] text-gray-400">参照: {s.section}</div>}
                {s.excerpt && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{s.excerpt}</p>}
                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-400">
                  {s.discoveredAt && <span>発見 {s.discoveredAt}</span>}
                  {s.confidence && <span>確度 {s.confidence}</span>}
                  {s.addedByRunId && <span>追加Run {s.addedByRunId}</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 根拠リンク */}
      {c.evidenceLinks && c.evidenceLinks.length > 0 && (
        <Section title="根拠リンク">
          <ul className="grid grid-cols-2 gap-1 text-sm">
            {c.evidenceLinks.map((e, i) => (
              <li key={i} className="break-all text-gray-700 dark:text-gray-200">
                <span className="font-mono text-[11px]">{e.path}</span>
                {e.note && <span className="text-gray-400"> — {e.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 調査履歴 */}
      {c.researchLogs && c.researchLogs.length > 0 && (
        <Section title="調査履歴">
          <ol className="grid grid-cols-2 gap-2">
            {[...c.researchLogs].reverse().map((r, i) => (
              <li key={i} className="border-l-2 border-blue-200 pl-3 dark:border-blue-800">
                <div className="text-xs font-semibold text-gray-500">
                  {r.date} · {r.type}
                  {r.impact && r.impact !== 'no_change' && (
                    <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{r.impact}</span>
                  )}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">{r.note}</div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-gray-400">
                  {r.sourcePath && <span className="break-all">出典 {r.sourcePath}</span>}
                  {r.runId && <span>Run {r.runId}</span>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* スコア変更・取り込み履歴（history に before/after/reason があるもの） */}
      {c.history && c.history.some((h) => h.before || h.after || h.reason) && (
        <Section title="変更・取り込み履歴">
          <ol className="space-y-1.5">
            {[...c.history].reverse().filter((h) => h.before || h.after || h.reason || h.runId).map((h, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-300">
                <span className="text-gray-400">{(h.timestamp ?? h.at ?? '').slice(0, 16).replace('T', ' ')}</span> · {h.action}
                {(h.before || h.after) && <span className="text-gray-500"> （{h.before ?? '—'} → {h.after ?? '—'}）</span>}
                {h.reason && <span className="text-gray-500"> / {h.reason}</span>}
                {h.runId && <span className="text-gray-400"> [Run {h.runId}]</span>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* 関連リンク */}
      <Section title="関連リンク">
        <div className="space-y-1 text-sm">
          {c.links?.vault && <Row label="Vault" value={c.links.vault} />}
          {c.links?.researchNote && <Row label="調査ノート" value={c.links.researchNote} />}
          {c.links?.epicId ? (
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Epic</span>
              <Link href={`/epic/${c.links.epicId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{c.links.epicId}</Link>
            </div>
          ) : (
            <Row label="Epic" value="未作成" />
          )}
          {c.links?.runId && (
            <div className="flex justify-between py-1">
              <span className="text-gray-400">ExecutionRun</span>
              <Link href={`/logs?runId=${c.links.runId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{c.links.runId}</Link>
            </div>
          )}
        </div>
      </Section>

      {c.notes && (
        <Section title="メモ">
          <p className="text-sm text-gray-700 dark:text-gray-200">{c.notes}</p>
          {c.nextAction && <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">次アクション: {c.nextAction}</p>}
        </Section>
      )}
    </div>
  )
}
