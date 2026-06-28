import type { ReactNode } from 'react'

type Accent = 'blue' | 'amber' | 'green' | 'rose' | 'gray' | 'indigo'
type Tone = 'default' | 'done' | 'current' | 'muted'

const accentStyles: Record<Accent, { strip: string; badge: string; glow: string }> = {
  blue: {
    strip: 'bg-blue-500',
    badge: 'bg-blue-600 text-white',
    glow: 'bg-blue-50 dark:bg-blue-950/20',
  },
  amber: {
    strip: 'bg-amber-500',
    badge: 'bg-amber-500 text-white',
    glow: 'bg-amber-50 dark:bg-amber-950/20',
  },
  green: {
    strip: 'bg-green-500',
    badge: 'bg-green-600 text-white',
    glow: 'bg-green-50 dark:bg-green-950/20',
  },
  rose: {
    strip: 'bg-rose-500',
    badge: 'bg-rose-600 text-white',
    glow: 'bg-rose-50 dark:bg-rose-950/20',
  },
  gray: {
    strip: 'bg-gray-500',
    badge: 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-900',
    glow: 'bg-gray-50 dark:bg-gray-800/40',
  },
  indigo: {
    strip: 'bg-indigo-500',
    badge: 'bg-indigo-600 text-white',
    glow: 'bg-indigo-50 dark:bg-indigo-950/20',
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
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black ${style.badge}`}>
            {n}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black leading-snug text-gray-950 dark:text-gray-50">{title}</h2>
            {lead && <p className="mt-1 text-sm font-semibold leading-relaxed text-gray-600 dark:text-gray-300">{lead}</p>}
          </div>
        </div>
        <div className={`mt-5 rounded-2xl p-3 ${style.glow}`}>{children}</div>
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
      className={`w-full rounded-xl border px-4 py-3 text-left shadow-sm ${
        highlight
          ? 'border-rose-300 bg-rose-50 text-rose-800 ring-2 ring-rose-300 dark:border-rose-900 dark:bg-rose-950/25 dark:text-rose-200 dark:ring-rose-800'
          : toneStyles[tone]
      }`}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="text-xl leading-none">{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-snug">{label}</p>
          {sub && (
            <p className={`mt-1 text-xs leading-relaxed ${highlight ? 'font-bold' : 'font-medium opacity-80'}`}>
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
          {i > 0 && <span className="py-1 text-xl font-black text-gray-400 dark:text-gray-600">↓</span>}
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
      <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-center text-sm font-black text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
        ↻ 最初に戻る（くり返す）
      </div>
    </div>
  )
}

export function StatTiles({ tiles }: { tiles: { label: string; value: string; desc?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{tile.label}</p>
          <p className="mt-1 break-words text-2xl font-black leading-tight text-blue-700 dark:text-blue-300">{tile.value}</p>
          {tile.desc && <p className="mt-2 text-[11px] font-medium leading-relaxed text-gray-500 dark:text-gray-400">{tile.desc}</p>}
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
          {i > 0 && <span className="py-1 text-xl font-black text-gray-400 dark:text-gray-600">↓</span>}
          <div
            className={`w-full rounded-xl border px-4 py-3 shadow-sm ${
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
            {item.note && <p className="mt-1 text-xs font-medium leading-relaxed opacity-80">{item.note}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LegendGrid({ items }: { items: { dot: string; term: string; desc: string }[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const isClass = item.dot.includes('bg-')
        return (
          <div key={item.term} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            {isClass ? (
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${item.dot}`} />
            ) : (
              <span className="shrink-0 text-base leading-none">{item.dot}</span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black leading-snug text-gray-900 dark:text-gray-100">{item.term}</p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-gray-500 dark:text-gray-400">{item.desc}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
