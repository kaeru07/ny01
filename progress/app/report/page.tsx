export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import AutoExecReport from '@/components/operations/AutoExecReport'

function one(searchParams: Record<string, string | string[] | undefined> | undefined, key: string): string {
  const value = searchParams?.[key]
  return typeof value === 'string' ? value : ''
}

export default async function AutoExecutionReportPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  return (
    <div className="space-y-4 px-4 pb-5 pt-4">
      <PageGuide
        title="レポート"
        guide="AI工場の自動実行を1件ずつ深く確認する専用ページです。検索・期間・状態・実行者・対象アプリ・レビュー状態で絞り込めます。"
      />
      <AutoExecReport
        standalone
        basePath="/report"
        q={one(searchParams, 'q')}
        range={one(searchParams, 'range')}
        status={one(searchParams, 'status')}
        executor={one(searchParams, 'executor')}
        app={one(searchParams, 'app')}
        review={one(searchParams, 'review')}
        limit={one(searchParams, 'limit')}
        group={one(searchParams, 'group')}
      />
    </div>
  )
}
