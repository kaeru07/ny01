'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LoopClosureReport, LoopHealResult } from '@/types/knowledge'

// Execution→Review→Knowledge→Next Epic ループの「閉じ具合」を一目で確認するカード（可視化のみ）。
// /api/operations/loop-health を GET（測定）/ POST（自己修復）で叩く。判定ロジックは持たない。
// 一般ユーザーが「ループは閉じているか / こぼれは何件か / 各段はつながっているか」を分かる表現にする。

const GAP_LABEL: Record<string, string> = {
  reviewed_without_knowledge: 'レビュー済みなのにKnowledge未生成',
  knowledge_without_next_epic: 'Knowledgeなのに次Epic候補なし',
  needs_followup_without_recommendation: '修正依頼なのに作業候補なし',
}

export default function LoopHealthCard() {
  const [report, setReport] = useState<LoopClosureReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [healing, setHealing] = useState(false)
  const [healMsg, setHealMsg] = useState<string | null>(null)
  const [triaging, setTriaging] = useState<string | null>(null)
  const [triageMsg, setTriageMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/operations/loop-health', { cache: 'no-store' })
      setReport(res.ok ? await res.json() : null)
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function heal() {
    setHealing(true)
    setHealMsg(null)
    try {
      const res = await fetch('/api/operations/loop-health', { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      const result: LoopHealResult & { success: boolean } = await res.json()
      const created = result.createdKnowledgeRecommendations + result.createdFollowupRecommendations
      setHealMsg(
        result.healed > 0
          ? `こぼれ ${result.healed} 件を修復（新規候補 ${created} 件）。`
          : 'こぼれはありませんでした。',
      )
      setReport(result.after)
    } catch {
      setHealMsg('自己修復に失敗しました。時間をおいて再実行してください。')
    } finally {
      setHealing(false)
    }
  }

  async function triageGroup(
    groupKey: string,
    candidateIds: string[],
    status: 'hold' | 'rejected',
  ) {
    if (
      status === 'rejected' &&
      !window.confirm(`同じ案件の候補 ${candidateIds.length} 件をまとめて却下しますか？`)
    ) {
      return
    }
    setTriaging(groupKey)
    setTriageMsg(null)
    try {
      const res = await fetch('/api/recommended-epics/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: candidateIds,
          status,
          detail: 'ループ健全性カードから案件単位で一括トリアージ',
        }),
      })
      const result = await res.json()
      if (!res.ok || !result.ok) throw new Error(result.error || String(res.status))
      setTriageMsg(
        `${result.updated} 件をまとめて${status === 'hold' ? '保留' : '却下'}しました。`,
      )
      await load()
    } catch {
      setTriageMsg('一括トリアージに失敗しました。候補一覧から個別に確認してください。')
    } finally {
      setTriaging(null)
    }
  }

  if (loading && !report) {
    return (
      <section className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-400 dark:border-gray-800">
        ループの健全性を読み込み中…
      </section>
    )
  }
  if (!report) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-900/20">
        ループの健全性を取得できませんでした。
        <button onClick={load} className="ml-2 underline">
          再読み込み
        </button>
      </section>
    )
  }

  const closed = report.closed
  const cls = closed
    ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
    : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
  const s = report.stage

  return (
    <section className={`rounded-2xl border p-4 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none" aria-hidden>
            {closed ? '🟢' : '🟡'}
          </span>
          <div>
            <p className="text-[11px] font-medium text-gray-400">ループの健全性</p>
            <p className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
              {closed ? '閉じています（全段つながり済み）' : `こぼれ ${report.gapCount} 件`}
            </p>
          </div>
        </div>
        <button onClick={load} className="shrink-0 text-[11px] text-blue-600 underline">
          更新
        </button>
      </div>

      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        実行 → レビュー → 学び（Knowledge） → 次のEpic候補、の流れが切れていないかを測定します。
      </p>

      {/* 閉ループ率（こぼれが0でも100%にならない理由を説明する） */}
      {report.metric && (
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2.5 dark:bg-gray-900/40">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">閉ループ率（目標 80%）</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {report.metric.closedLoopRatePct}%
              <span className="ml-1 text-[11px] font-normal text-gray-400">
                {report.metric.closedLoopRuns} / {report.metric.countableRuns} Run
              </span>
            </span>
          </div>
          {report.metric.openLoopRuns > 0 && (
            <>
              <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                こぼれは0でも、未クローズ {report.metric.openLoopRuns} 件があるため100%になりません。内訳:
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <Cell label="一次レビュー待ち" value={report.metric.openBreakdown.awaitingFirstReview} />
                <Cell label="修正依頼" value={report.metric.openBreakdown.awaitingFix} />
                <Cell label="人間判断待ち" value={report.metric.openBreakdown.blockedOnHuman} />
                <Cell
                  label="未補完(自己修復可)"
                  value={report.metric.openBreakdown.other}
                  tone={report.metric.openBreakdown.other > 0 ? 'warn' : undefined}
                />
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-gray-600 dark:text-gray-300">
                {report.metric.nextActionsToRaise.map((a, i) => (
                  <li key={i}>・{a}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* 受け渡し（候補→Epic化/トリアージ）: ループ最終リンクの滞留を可視化 */}
      {report.handoff && report.handoff.reviewCandidatesTotal > 0 && (
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2.5 dark:bg-gray-900/40">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              候補の受け渡し率（候補→トリアージ）
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {report.handoff.handoffRatePct}%
              <span className="ml-1 text-[11px] font-normal text-gray-400">
                {report.handoff.reviewCandidatesActedOn} / {report.handoff.reviewCandidatesTotal} 候補
              </span>
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            <Cell label="Epic化済み" value={report.handoff.reviewCandidatesPromoted} tone="ok" />
            <Cell
              label="未トリアージ"
              value={
                report.handoff.distinctPendingIssues > 0 &&
                report.handoff.distinctPendingIssues < report.handoff.reviewCandidatesPendingTriage
                  ? `${report.handoff.reviewCandidatesPendingTriage}（実質${report.handoff.distinctPendingIssues}案件）`
                  : report.handoff.reviewCandidatesPendingTriage
              }
              tone={report.handoff.reviewCandidatesPendingTriage > 0 ? 'warn' : 'ok'}
            />
            <Cell label="候補総数" value={report.handoff.reviewCandidatesTotal} />
          </div>
          <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">・{report.handoff.nextAction}</p>

          {/* 次に着手すべき滞留候補（案件単位に集約 = 重複 followup を1判断にまとめて導線化） */}
          {report.handoff.consolidatedPending && report.handoff.consolidatedPending.length > 0 && (
            <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  次に着手すべき案件（上位{report.handoff.consolidatedPending.length}件・重複まとめ済み）
                </span>
                <a href="/recommended-epics" className="text-[11px] text-blue-600 underline">
                  すべてトリアージ →
                </a>
              </div>
              <ul className="mt-1.5 space-y-1">
                {report.handoff.consolidatedPending.map((g) => (
                  <li key={g.groupKey} className="rounded-lg border border-gray-200 p-2 text-[11px] dark:border-gray-700">
                    <div className="flex items-start gap-1.5">
                      <span
                        className={`mt-0.5 shrink-0 rounded px-1 py-px text-[9px] font-bold ${
                          g.priority === 'P0'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            : g.priority === 'P1'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {g.priority}
                      </span>
                      <span className="min-w-0 flex-1 text-gray-700 dark:text-gray-200">
                        <span className="break-words">{g.title}</span>
                        {g.targetApp && <span className="ml-1 text-gray-400">({g.targetApp})</span>}
                      </span>
                      {g.count > 1 && (
                        <span className="mt-0.5 shrink-0 rounded-full bg-blue-100 px-1.5 py-px text-[9px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          ×{g.count}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <a
                        href={`/recommended-epics/${encodeURIComponent(g.representativeId)}`}
                        className="text-blue-600 underline"
                      >
                        内容を確認
                      </a>
                      <button
                        type="button"
                        disabled={triaging !== null}
                        onClick={() => triageGroup(g.groupKey, g.candidateIds, 'hold')}
                        className="rounded border border-gray-300 px-2 py-0.5 text-gray-600 disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                      >
                        {triaging === g.groupKey ? '処理中…' : `${g.count}件を保留`}
                      </button>
                      <button
                        type="button"
                        disabled={triaging !== null}
                        onClick={() => triageGroup(g.groupKey, g.candidateIds, 'rejected')}
                        className="rounded border border-rose-300 px-2 py-0.5 text-rose-600 disabled:opacity-40 dark:border-rose-700 dark:text-rose-300"
                      >
                        {triaging === g.groupKey ? '処理中…' : `${g.count}件を却下`}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {triageMsg && <p className="mt-2 text-[11px] text-gray-600 dark:text-gray-300">{triageMsg}</p>}
              <p className="mt-1 text-[10px] text-gray-400">
                ×N は同じ案件への重複候補数。/recommended-epics でまとめて承認/Epic化すると、候補が次の実行へ戻りループが閉じます。
              </p>
            </div>
          )}
        </div>
      )}

      {/* 各段の件数 */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Cell label="レビュー済みRun" value={s.reviewedRuns} />
        <Cell label="Knowledge" value={s.knowledgeRecords} />
        <Cell
          label="次Epic候補つき"
          value={`${s.knowledgeWithNextEpic} / ${s.knowledgeRecords}`}
          tone={s.knowledgeWithNextEpic === s.knowledgeRecords ? 'ok' : 'warn'}
        />
        <Cell label="修正依頼Run" value={s.needsFollowupRuns} />
        <Cell
          label="修正候補"
          value={s.followupRecommendations}
          tone={s.followupRecommendations >= s.needsFollowupRuns ? 'ok' : 'warn'}
        />
        <Cell label="レビュー起点候補" value={s.reviewKnowledgeRecommendations} />
      </div>

      {/* 参照整合（Next Epic候補のリンク切れ）: 自己修復で消せないため gaps とは別枠で可視化のみ */}
      {report.referenceIntegrity && report.referenceIntegrity.brokenNextEpicCandidates > 0 && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] dark:border-rose-800 dark:bg-rose-900/20">
          <p className="font-semibold text-rose-700 dark:text-rose-300">
            Next Epic候補の参照切れ: {report.referenceIntegrity.brokenNextEpicCandidates} 件
          </p>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            Knowledgeに次Epic候補IDは入っているが、指す先の候補が存在しません（過去のデータ縮小が原因）。
            自己修復（backfill）では再生成されないため、件数の可視化のみ行っています。再生成するかは人間判断です。
          </p>
        </div>
      )}

      {/* こぼれ一覧 */}
      {report.gaps.length > 0 && (
        <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[11px] dark:bg-gray-900/40">
          <p className="mb-1 font-semibold text-gray-700 dark:text-gray-200">
            こぼれている箇所（{report.gaps.length}）
          </p>
          <ul className="space-y-1 text-gray-600 dark:text-gray-300">
            {report.gaps.slice(0, 8).map((g, i) => (
              <li key={i} className="break-all">
                <span className="font-medium">{GAP_LABEL[g.kind] ?? g.kind}</span>
                {g.runId ? `（run ${g.runId}）` : g.knowledgeId ? `（${g.knowledgeId}）` : ''}
              </li>
            ))}
            {report.gaps.length > 8 && (
              <li className="text-gray-400">ほか {report.gaps.length - 8} 件</li>
            )}
          </ul>
        </div>
      )}

      {/* 自己修復 */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={heal}
          disabled={healing || closed}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {healing ? '修復中…' : closed ? 'こぼれなし' : 'こぼれを自己修復'}
        </button>
        {healMsg && <span className="text-[11px] text-gray-600 dark:text-gray-300">{healMsg}</span>}
      </div>

      <p className="mt-2 text-[10px] text-gray-400">
        自己修復は既存の backfill（冪等）を実行し、未生成のKnowledge・次Epic候補・修正候補を補完します。
      </p>
    </section>
  )
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'ok' | 'warn'
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-green-700 dark:text-green-300'
      : tone === 'warn'
        ? 'text-rose-700 dark:text-rose-300'
        : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-lg bg-white/70 px-2.5 py-2 dark:bg-gray-900/40">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`mt-0.5 text-sm font-bold ${toneCls}`}>{value}</div>
    </div>
  )
}
