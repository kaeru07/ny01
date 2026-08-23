import PageGuide from '@/components/newux/PageGuide'
import { buildRows, readMarketResearch, sortRows } from '@/lib/app-market-research'
import MarketResearchClient from './MarketResearchClient'

export const dynamic = 'force-dynamic'

export default async function AppMarketResearchPage() {
  const store = await readMarketResearch()
  const rows = sortRows(buildRows(store), 'value')

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="App Market Research"
        guide="日本のApp Storeで、個人・小規模チームが出して実際にヒットしているアプリを自動実行のたびに3本前後ずつ調べて貯める画面です。順位・評価件数・DL数など確認できた実績だけを根拠URL付きで記録し、個人＋AIで再現・差別化・収益化できるかを比較します。"
      />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
        <h2 className="text-sm font-black">見方</h2>
        <p className="mt-2 font-semibold">
          行をタップすると、なぜ伸びたか・差別化案・負荷・前回との差分・調査履歴・情報源が開きます。
          アプリ名で App Store、Google Play リンクでストアを開けます。
        </p>
        <p className="mt-2 font-semibold">
          アプリは1本＝1レコードで、調査するたびに履歴（スナップショット）が積み上がります。同じアプリで行が増えることはありません。
          数値の横の緑／赤は前回調査との差です（順位は上昇が緑）。
        </p>
        <p className="mt-2 font-semibold">
          判定は「本採用候補（個人・小規模法人）」「参考候補（開発者規模が確認できない）」「対象外（大手・買い切り）」の3段階。
          確認できなかった項目は推測で埋めず「確認できない」と表示します。
        </p>
      </section>

      <MarketResearchClient rows={rows} updatedAt={store.updatedAt} />
    </main>
  )
}
