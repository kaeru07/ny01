import type { ReactNode } from 'react'

type Accent = 'blue' | 'amber' | 'green' | 'rose' | 'gray' | 'indigo'
type Tone = 'default' | 'done' | 'current' | 'muted'

const accentStyles: Record<Accent, { strip: string; badge: string; glow: string }> = {
  blue: {
    strip: 'bg-blue-500',
    badge: 'bg-blue-600 text-white',
    glow: 'bg-blue-50/35 dark:bg-blue-950/10',
  },
  amber: {
    strip: 'bg-amber-500',
    badge: 'bg-amber-500 text-white',
    glow: 'bg-amber-50/35 dark:bg-amber-950/10',
  },
  green: {
    strip: 'bg-green-500',
    badge: 'bg-green-600 text-white',
    glow: 'bg-green-50/35 dark:bg-green-950/10',
  },
  rose: {
    strip: 'bg-rose-500',
    badge: 'bg-rose-600 text-white',
    glow: 'bg-rose-50/35 dark:bg-rose-950/10',
  },
  gray: {
    strip: 'bg-gray-500',
    badge: 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900',
    glow: 'bg-gray-50/35 dark:bg-gray-800/20',
  },
  indigo: {
    strip: 'bg-indigo-500',
    badge: 'bg-indigo-600 text-white',
    glow: 'bg-indigo-50/35 dark:bg-indigo-950/10',
  },
}

const toneStyles: Record<Tone, string> = {
  default: 'border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
  done: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-200',
  current: 'border-blue-200 bg-blue-50 text-blue-800 ring-2 ring-blue-300 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200 dark:ring-blue-800',
  muted: 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-500',
}

export function Slide({
  n,
  title,
  accent = 'gray',
  lead,
  children,
}: {
  n: number
  title: string
  accent?: Accent
  lead?: string
  children: ReactNode
}) {
  const style = accentStyles[accent] ?? accentStyles.gray
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className={`h-1.5 ${style.strip}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${style.badge}`}>
            {n}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black leading-snug text-gray-950 dark:text-gray-50">{title}</h2>
            {lead && <p className="mt-0.5 text-xs font-semibold leading-relaxed text-gray-600 dark:text-gray-300">{lead}</p>}
          </div>
        </div>
        <div className={`mt-3 rounded-2xl p-0 ${style.glow}`}>{children}</div>
      </div>
    </section>
  )
}

export function IconChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  )
}

function FlowNode({
  label,
  sub,
  icon,
  highlight,
  tone = 'default',
}: {
  label: string
  sub?: string
  icon?: string
  highlight?: boolean
  tone?: Tone
}) {
  return (
    <div
      className={`w-full rounded-xl border px-3 py-2 text-left shadow-sm ${
        highlight
          ? 'border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-300 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-200 dark:ring-rose-800'
          : toneStyles[tone]
      }`}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-base leading-none">{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-snug">{label}</p>
          {sub && (
            <p className={`mt-0.5 text-[11px] leading-snug ${highlight ? 'font-bold' : 'font-medium opacity-80'}`}>
              {sub}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export function FlowDiagram({
  steps,
}: {
  steps: { label: string; sub?: string; icon?: string; highlight?: boolean; tone?: Tone }[]
}) {
  return (
    <div className="flex flex-col items-stretch">
      {steps.map((step, i) => (
        <div key={`${step.label}-${i}`} className="flex flex-col items-center">
          {i > 0 && <span className="py-0.5 text-base font-black text-gray-400 dark:text-gray-600">↓</span>}
          <FlowNode {...step} />
        </div>
      ))}
    </div>
  )
}

export function LoopDiagram({
  steps,
}: {
  steps: { label: string; sub?: string; icon?: string; highlight?: boolean; tone?: Tone }[]
}) {
  return (
    <div>
      <FlowDiagram steps={steps} />
      <div className="mt-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-center text-xs font-black text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
        ↻ 最初に戻る（くり返す）
      </div>
    </div>
  )
}

export function StatTiles({ tiles }: { tiles: { label: string; value: string; desc?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{tile.label}</p>
          <p className="mt-1 break-words text-xl font-black leading-tight text-blue-700 dark:text-blue-300">{tile.value}</p>
          {tile.desc && <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-snug text-gray-500 dark:text-gray-400">{tile.desc}</p>}
        </div>
      ))}
    </div>
  )
}

export function Roadmap({
  items,
}: {
  items: { label: string; note?: string; state: 'done' | 'current' | 'future' | 'todo' }[]
}) {
  return (
    <div className="flex flex-col items-stretch">
      {items.map((item, i) => (
        <div key={item.label} className="flex flex-col items-center">
          {i > 0 && <span className="py-0.5 text-base font-black text-gray-400 dark:text-gray-600">↓</span>}
          <div
            className={`w-full rounded-xl border px-3 py-2 shadow-sm ${
              item.state === 'done'
                ? toneStyles.done
                : item.state === 'current'
                  ? toneStyles.current
                  : toneStyles.muted
            }`}
          >
            <p className="text-sm font-black leading-snug">
              {item.state === 'done' && '✅ '}
              {item.state === 'current' && '📍いまここ '}
              {item.label}
            </p>
            {item.note && <p className="mt-0.5 text-[11px] font-medium leading-snug opacity-80">{item.note}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LegendGrid({ items }: { items: { dot: string; term: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const isClass = item.dot.includes('bg-')
        return (
          <div key={item.term} className="flex gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
            {isClass ? (
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.dot}`} />
            ) : (
              <span className="shrink-0 text-sm leading-none">{item.dot}</span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-black leading-snug text-gray-900 dark:text-gray-100">{item.term}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
