export const dynamic = 'force-dynamic'

import { getRecommendations } from '@/lib/recommended-epics-store'
import RecommendationList from '@/components/recommended/RecommendationList'
import GenerateButton from '@/components/recommended/GenerateButton'

export default async function RecommendedEpicsPage() {
  const recommendations = await getRecommendations()

  return (
    <div className="space-y-4 px-4 pb-24 pt-6">
      <header className="space-y-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">おすすめ追加Epic</h1>
          <GenerateButton />
        </div>
        <p className="text-sm text-gray-400">
          AI工場が Vault / Progress / 調査 / 既存Epic / 実行履歴を見て抽出した追加候補。
          <span className="font-semibold">承認した候補だけ</span> epics.json に追加され Factory 対象になる。
        </p>
        <p className="text-[11px] text-gray-400">
          抽出は提案のみ（自動Epic追加なし）。承認・Epic化は手動のみ。危険 riskFlags は承認時に注意表示。
        </p>
      </header>

      <RecommendationList recommendations={recommendations} />
    </div>
  )
}
