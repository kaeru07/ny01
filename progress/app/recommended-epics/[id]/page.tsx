export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRecommendation } from '@/lib/recommended-epics-store'
import { epicPriorityLabel } from '@/lib/epic-priority-label'
import { recStatusMeta, impactMeta } from '@/lib/recommended-epics-ui'
import RecActions from '@/components/recommended/RecActions'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  )
}

export default async function RecommendationDetailPage({ params }: { params: { id: string } }) {
  const r = await getRecommendation(params.id)
  if (!r) notFound()

  const st = recStatusMeta(r.status)
  const im = impactMeta(r.monetizationImpact)
  const elig = r.factoryEligiblePreview

  return (
    <div className="space-y-3 px-4 pb-24 pt-6">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Link href="/recommended-epics" className="hover:underline">おすすめ追加Epic</Link>
        <span className="text-gray-300">/</span>
        <span className="truncate text-gray-500">{r.title}</span>
      </div>

      {/* 概要 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${im.cls}`}>{im.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">
            {r.kind === 'new_epic' ? '新規Epic' : '既存Epic継続'}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">優先度{epicPriorityLabel(r.priority)}</span>
        </div>
        <h1 className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">{r.title}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{r.reason}</p>
      </section>

      {/* 重複チェック / Factory判定 */}
      <Section title="重複チェック / Factory対象判定">
        {r.duplicate?.duplicate ? (
          <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">⚠ 重複あり: {r.duplicate.reason}</p>
        ) : (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">重複なし（承認可）</p>
        )}
        {elig && (() => {
          const managed = elig.factoryManaged ?? elig.eligible
          const cls = elig.classification ?? (elig.eligible ? 'auto' : 'approval')
          const text = !managed
            ? `Factory対象外: ${elig.reasons.join(' / ')}`
            : cls === 'auto'
              ? 'Factory 自動実行可'
              : `Factory対象 / 要承認: ${elig.reasons.join(' / ')}`
          return (
            <p className={`mt-1 text-sm font-semibold ${!managed ? 'text-gray-500 dark:text-gray-400' : cls === 'auto' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {text}
            </p>
          )
        })()}
        {r.riskFlags.length > 0 && (
          <p className="mt-1 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
            ⚠ riskFlags: {r.riskFlags.join(', ')} — 承認時は影響範囲を確認してください（自動実行はされません）。
          </p>
        )}
      </Section>

      {/* 承認フロー */}
      <RecActions id={r.id} status={r.status} kind={r.kind} duplicate={!!r.duplicate?.duplicate} createdEpicId={r.createdEpicId} />

      {/* Epic Contract 内容 */}
      <Section title="Epic Contract（候補）">
        <Row label="対象アプリ" value={r.targetApp} />
        <Row label="既存Epic（継続先）" value={r.relatedEpicId} />
        <Row label="優先度" value={r.priority} />
        <Row label="decisionPolicy" value={r.decisionPolicy} />
        <Row label="riskFlags" value={r.riskFlags.length ? r.riskFlags.join(', ') : 'なし'} />
        <Row label="推奨executor" value={[r.preferredExecutor, r.fallbackExecutor].filter(Boolean).join(' → ')} />
        <div className="mt-2">
          <div className="mb-1 text-xs font-semibold text-gray-400">doneCriteria</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-200">
            {r.doneCriteria.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      </Section>

      {/* 関連 */}
      <Section title="関連リンク / 抽出元">
        <Row label="抽出元" value={`${r.sourceKind}${r.sourceRef ? ` / ${r.sourceRef}` : ''}`} />
        <Row label="goalId" value={r.goalId} />
        <Row label="parentEpicId" value={r.parentEpicId} />
        <Row label="sourceRunId" value={r.sourceRunId} />
        <Row label="sourceKnowledgeId" value={r.sourceKnowledgeId} />
        {r.relatedVault && r.relatedVault.length > 0 && (
          <div className="py-1 text-sm">
            <span className="text-gray-400">関連Vaultメモ</span>
            <ul className="mt-1 list-disc pl-5 text-gray-700 dark:text-gray-200">
              {r.relatedVault.map((v, i) => <li key={i} className="break-all">{v}</li>)}
            </ul>
          </div>
        )}
        {r.relatedRunIds && r.relatedRunIds.length > 0 && (
          <div className="py-1 text-sm">
            <span className="text-gray-400">関連ExecutionRun</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {r.relatedRunIds.map((rid) => (
                <Link key={rid} href={`/logs?runId=${rid}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:underline dark:bg-blue-900/30 dark:text-blue-400">{rid}</Link>
              ))}
            </div>
          </div>
        )}
        {r.createdEpicId && (
          <div className="flex justify-between py-1 text-sm">
            <span className="text-gray-400">作成済みEpic</span>
            <Link href={`/epic/${r.createdEpicId}`} className="font-medium text-blue-600 hover:underline dark:text-blue-400">{r.createdEpicId}</Link>
          </div>
        )}
      </Section>

      {/* 操作履歴 */}
      {r.history && r.history.length > 0 && (
        <Section title="操作履歴">
          <ol className="space-y-1.5">
            {[...r.history].reverse().map((h, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-300">
                <span className="text-gray-400">{h.at.slice(0, 16).replace('T', ' ')}</span> · {h.action}
                {h.detail && <span className="text-gray-500"> — {h.detail}</span>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {r.notes && (
        <Section title="メモ">
          <p className="text-sm text-gray-700 dark:text-gray-200">{r.notes}</p>
        </Section>
      )}
    </div>
  )
}
