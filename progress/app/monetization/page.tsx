export const dynamic = 'force-dynamic'

import { getCandidates } from '@/lib/monetization-store'
import MonetizationList from '@/components/monetization/MonetizationList'
import AddCandidateButton from '@/components/monetization/AddCandidateButton'

export default async function MonetizationPage() {
  const candidates = await getCandidates()

  return (
    <div className="space-y-4 px-4 pb-24 pt-4">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">収益化候補管理</h1>
          <AddCandidateButton />
        </div>
        <p className="text-sm text-gray-400">
          AI工場が発掘した候補を調査・レビューし、<span className="font-semibold">人間が承認した候補だけ</span>を Epic として Factory へ投入する。
        </p>
        <p className="text-[11px] text-gray-400">
          発掘 → 調査 → レビュー → Epic化承認 → Factory実行。Epic化は手動のみ（自動Epic化なし）。
        </p>
      </header>

      <MonetizationList candidates={candidates} />
    </div>
  )
}
