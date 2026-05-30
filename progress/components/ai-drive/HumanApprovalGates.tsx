import type { HumanApprovalGate, ApprovalPolicy } from '@/types/ai-drive'

const policyStyle: Record<ApprovalPolicy, { label: string; bg: string; text: string; icon: string }> = {
  ai_ok: { label: 'AIに任せてよい', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', icon: '🤖' },
  human_required: { label: '人間承認が必要', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', icon: '🧑' },
  forbidden: { label: '禁止', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: '⛔' },
}

interface HumanApprovalGatesProps {
  gates: HumanApprovalGate[]
}

export default function HumanApprovalGates({ gates }: HumanApprovalGatesProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">人間承認ゲート</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        AI に任せてよい範囲と、人間が必ず判断する範囲の境界を定義する。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {gates.map((gate) => {
          const style = policyStyle[gate.policy]
          return (
            <div
              key={gate.category}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {gate.category}
                </div>
              </div>
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${style.bg} ${style.text}`}
              >
                <span>{style.icon}</span>
                <span>{style.label}</span>
              </div>
              {gate.note && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{gate.note}</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
