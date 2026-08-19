import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { getAppMarketAnalysis, type AppMarketAnalysisRecord } from '@/lib/app-market-analysis'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'

export const dynamic = 'force-dynamic'

function formatDate(value: string): string {
  if (!value) return '日時不明'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function pct(count: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((count / total) * 100)}%`
}

export default async function AppMarketAnalysisPage() {
  const analysis = await getAppMarketAnalysis()

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="マーケット市場分析"
        guide="アプリ承認欄へ入る候補の生成元、市場観測、AI/fallbackの比率、カテゴリ偏りを確認します。"
      />
      <SubTabBar items={APP_DEVELOPMENT_SUBTABS} />

      <section className="grid gap-2 sm:grid-cols-4">
        <Metric label="候補総数" value={`${analysis.counts.total}`} detail={`直近 ${analysis.counts.recent}件を重点表示`} />
        <Metric label="開発寄り" value={pct(analysis.counts.developerRecent, analysis.counts.recent)} detail={`直近 ${analysis.counts.developerRecent}/${analysis.counts.recent}件`} tone="blue" />
        <Metric label="fallback" value={pct(analysis.counts.fallbackRecent, analysis.counts.recent)} detail={`直近 ${analysis.counts.fallbackRecent}/${analysis.counts.recent}件`} tone="amber" />
        <Metric label="汎用案" value={pct(analysis.counts.genericFallbackRecent, analysis.counts.recent)} detail={`直近 ${analysis.counts.genericFallbackRecent}/${analysis.counts.recent}件`} tone="rose" />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">偏りの見立て</h2>
        <ul className="mt-2 space-y-1.5">
          {analysis.findings.map((finding) => (
            <li key={finding} className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-semibold leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-200">
              {finding}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">カテゴリ分布</h2>
          <div className="mt-3 space-y-2">
            {analysis.categoryCounts.map((item) => (
              <BarRow key={item.key} label={item.label} count={item.count} total={analysis.counts.total} note={`直近 ${item.recentCount}`} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
          <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">生成モード</h2>
          <div className="mt-3 space-y-2">
            {analysis.modeCounts.map((item) => (
              <BarRow key={item.mode} label={item.mode} count={item.count} total={analysis.counts.total} note={`直近 ${item.recentCount}`} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <ObservationBlock
          title={`市場観測 ${analysis.latestMarket?.date ?? 'なし'}`}
          groups={[
            { label: '注目ジャンル', items: analysis.latestMarket?.genres ?? [] },
            { label: '収益化ヒント', items: analysis.latestMarket?.monetizationHints ?? [] },
          ]}
        />
        <ObservationBlock
          title={`AIニュース ${analysis.latestAiNews?.date ?? 'なし'}`}
          groups={[
            { label: '高影響ニュース', items: analysis.latestAiNews?.highlights ?? [] },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">候補ごとの導出過程</h2>
        {analysis.records.map((record) => (
          <CandidateTrace key={record.candidate.id} record={record} />
        ))}
      </section>
    </main>
  )
}

function Metric({ label, value, detail, tone = 'gray' }: { label: string; value: string; detail: string; tone?: 'gray' | 'blue' | 'amber' | 'rose' }) {
  const toneClass = {
    gray: 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/20',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20',
    rose: 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20',
  }[tone]
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">{detail}</p>
    </div>
  )
}

function BarRow({ label, count, total, note }: { label: string; count: number; total: number; note: string }) {
  const width = total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-gray-700 dark:text-gray-200">
        <span className="min-w-0 break-words">{label}</span>
        <span className="shrink-0 text-gray-400">{count}件 · {note}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-2 rounded-full bg-blue-600 dark:bg-blue-400" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function ObservationBlock({ title, groups }: { title: string; groups: Array<{ label: string; items: string[] }> }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">{group.label}</p>
            {group.items.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <li key={item} className="text-xs font-medium leading-relaxed text-gray-700 dark:text-gray-200">{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-gray-400">該当なし</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function CandidateTrace({ record }: { record: AppMarketAnalysisRecord }) {
  const candidate = record.candidate
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{formatDate(record.createdAt)}</Badge>
        <Badge>{record.categoryLabel}</Badge>
        <ModeBadge mode={record.generatedMode} />
        {record.isGenericFallback ? <Badge tone="amber">汎用fallback</Badge> : null}
        <Badge tone="gray">根拠:{record.derivationConfidence}</Badge>
      </div>
      <h3 className="mt-2 break-words text-base font-black leading-snug text-gray-900 dark:text-gray-100">{candidate.title}</h3>
      <p className="mt-1 break-words text-xs font-semibold leading-relaxed text-gray-600 dark:text-gray-300">{candidate.overview ?? candidate.purpose}</p>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <TraceBlock label="生成ログ" lines={[
          `mode: ${record.generatedMode}`,
          `reason: ${record.generatedReason}`,
          `seed: ${record.seedSources.length > 0 ? record.seedSources.join(', ') : '不明'}`,
        ]} />
        <TraceBlock label="市場判断" lines={[
          `ocean: ${candidate.oceanType ?? 'unknown'}`,
          candidate.marketValue ?? '市場価値未設定',
          candidate.oceanRationale ?? '競争環境の根拠未設定',
        ]} />
        <TraceBlock label="勝機" lines={(candidate.winningFactors ?? []).slice(0, 4)} empty="未設定" />
        <TraceBlock label="懸念" lines={(candidate.concerns ?? []).slice(0, 4)} empty="未設定" />
      </div>

      {record.seedTitles.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">保存されたseed</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {record.seedTitles.map((seed) => <Badge key={seed} tone="green">{seed}</Badge>)}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function TraceBlock({ label, lines, empty = 'なし' }: { label: string; lines: string[]; empty?: string }) {
  const visible = lines.filter((line) => line && line.trim())
  return (
    <div>
      <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">{label}</p>
      <ul className="mt-1 space-y-1">
        {(visible.length > 0 ? visible : [empty]).map((line) => (
          <li key={line} className="break-words text-xs font-medium leading-relaxed text-gray-700 dark:text-gray-200">{line}</li>
        ))}
      </ul>
    </div>
  )
}

function Badge({ children, tone = 'blue' }: { children: React.ReactNode; tone?: 'blue' | 'amber' | 'green' | 'gray' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200',
    amber: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
    green: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-200',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  }[tone]
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${toneClass}`}>{children}</span>
}

function ModeBadge({ mode }: { mode: AppMarketAnalysisRecord['generatedMode'] }) {
  if (mode === 'ai') return <Badge tone="green">AI生成</Badge>
  if (mode === 'fallback') return <Badge tone="amber">fallback</Badge>
  return <Badge tone="gray">生成元不明</Badge>
}
