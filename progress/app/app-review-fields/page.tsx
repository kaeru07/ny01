import PageGuide from '@/components/newux/PageGuide'
import SubTabBar from '@/components/navigation/SubTabBar'
import { getAppReviewFields } from '@/lib/app-review-fields'
import { IOS_BUILD_SUBTABS } from '@/lib/nav-groups'
import AppReviewFieldsClient from './AppReviewFieldsClient'

export const dynamic = 'force-dynamic'

export default async function AppReviewFieldsPage() {
  const apps = await getAppReviewFields()

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="審査提出準備"
        guide="App Store審査でApp Store Connectに入力する価格・著作権・カテゴリ・各URL・説明文などを、この画面で入力・保存し、項目ごとにコピーして貼り付けるページです。fastlaneメタデータ(fastlane/metadata)とapps.jsonの値が初期値として入り、入力して保存した値が優先されます。"
      />
      <SubTabBar items={IOS_BUILD_SUBTABS} />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
        <h2 className="text-sm font-black">使い方</h2>
        <p className="mt-2 font-semibold">アプリを開いて各項目を入力し、「保存」を押します。保存した値は次に開いたときも残ります。入力欄の右の「コピー」でその項目だけ、カード右上のボタンで全項目をまとめてコピーして、App Store Connect の対応する欄へ貼り付けます。</p>
        <p className="mt-2 font-semibold">「自動」バッジは fastlane メタデータ・apps.json から入った初期値です。上書きすると「入力値」になり、「自動値に戻す」で初期値へ戻せます。</p>
        <p className="mt-2 font-semibold">価格・年齢レーティング・App Privacy は目安の初期値です。審査提出前に必ず人が最終確認してください。</p>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        審査用デモアカウントのID・パスワード、連絡先の電話番号などの機密情報はこの画面に入力しないでください。保存先のリポジトリは公開されています。これらは App Store Connect に直接入力してください。
      </section>

      {apps.length === 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
          TestFlight対象workflowは見つかりませんでした。
        </section>
      ) : (
        <AppReviewFieldsClient apps={apps} />
      )}
    </main>
  )
}
