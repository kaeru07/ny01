import { redirect } from 'next/navigation'

// /operations は Automation へ統合済み。独立プロダクト化しないため /automation へ集約する。
// 役割分担: 全体ヘルス=Dashboard(/) / 承認=承認待ち(/approvals) / Epic進行=工場(/epic) / 実行制御=Automation(/automation)
export default function OperationsPage() {
  redirect('/automation')
}
