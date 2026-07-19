import PageGuide from '@/components/newux/PageGuide'
import SubTabBar from '@/components/navigation/SubTabBar'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'
import { getIosSigningGuideApps, type IosSigningGuideApp } from '@/lib/ios-signing-guide'
import CopyButton from './CopyButton'

export const dynamic = 'force-dynamic'

function ValueRow({ label, value }: { label: string; value: string | null }) {
  const text = value ?? '未設定'
  return (
    <div className="grid gap-1 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-800 sm:grid-cols-[160px_1fr_auto] sm:items-center">
      <dt className="text-xs font-black text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="break-all font-mono text-xs font-bold text-gray-900 dark:text-gray-100">{text}</dd>
      {value ? <CopyButton text={value} /> : null}
    </div>
  )
}

function StepCard({
  title,
  summary,
  rows,
}: {
  title: string
  summary: string
  rows: Array<{ label: string; value: string | null }>
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div>
        <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-500 dark:text-gray-400">{summary}</p>
      </div>
      <dl className="mt-3">
        {rows.map((row) => (
          <ValueRow key={row.label} label={row.label} value={row.value} />
        ))}
      </dl>
    </section>
  )
}

function AppGuideCard({ app }: { app: IosSigningGuideApp }) {
  return (
    <article className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">{app.appName}</h2>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700 dark:bg-green-900/30 dark:text-green-200">
              TestFlight対象
            </span>
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{app.appPathLabel}</p>
          <p className="mt-0.5 font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{app.repository ?? 'repository未設定'}</p>
        </div>
        <CopyButton text={app.copyText} label="このアプリの手順を全文コピー" />
      </div>

      <StepCard
        title="1. Apple Developer: Bundle IDを作る"
        summary="Certificates, Identifiers & Profiles > Identifiers > + > App IDs > App。Explicit Bundle IDで作成する。"
        rows={[
          { label: 'Description', value: app.appName },
          { label: 'Bundle ID Type', value: 'Explicit' },
          { label: 'Bundle ID', value: app.bundleId },
          { label: 'Capabilities', value: '追加なし（必要になった時だけ有効化）' },
        ]}
      />

      <StepCard
        title="2. App Store Connect: New Appを作る"
        summary="Apps > + > New App。ビルドをアップロードする前に、アプリレコードを先に作る。"
        rows={[
          { label: 'Platforms', value: 'iOS' },
          { label: 'Name', value: app.appName },
          { label: 'Primary Language', value: 'Japanese' },
          { label: 'Bundle ID', value: app.bundleId },
          { label: 'SKU', value: app.sku },
          { label: 'User Access', value: 'Full Access' },
        ]}
      />

      <StepCard
        title="3. Apple Developer: App Store Profileを作る"
        summary="Profiles > + > Distribution > App Store。作ったBundle IDと既存のApple Distribution証明書を選ぶ。"
        rows={[
          { label: 'Profile Type', value: 'App Store' },
          { label: 'App ID', value: app.bundleId },
          { label: 'Certificate', value: app.certificateReference ?? 'IOS_DISTRIBUTION_CERTIFICATE' },
          { label: 'Profile Name', value: app.provisioningProfileName },
        ]}
      />

      <StepCard
        title="4. Codemagic: ProfileをReference name付きで登録"
        summary="Team settings > codemagic.yaml settings > Code signing identities > iOS provisioning profiles。ダウンロードした.mobileprovisionをアップロードする。"
        rows={[
          { label: 'Profile file', value: '.mobileprovision' },
          { label: 'Reference name', value: app.provisioningProfileReference },
          { label: 'Bundle ID確認', value: app.bundleId },
        ]}
      />

      <StepCard
        title="5. Codemagic: Rebuildする"
        summary="署名profileを追加したあと、このworkflowを再実行する。成功するとTestFlightへアップロードされる。"
        rows={[
          { label: 'Codemagic App', value: app.rootDir },
          { label: 'Workflow ID', value: app.workflowId },
          { label: 'Workflow名', value: app.workflowName },
          { label: 'Branch', value: app.branch ?? 'main' },
          { label: 'ASC integration', value: app.appStoreConnectIntegration ?? 'ASC_API_KEY' },
        ]}
      />

      <details className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
        <summary className="cursor-pointer select-none text-sm font-black text-gray-900 dark:text-gray-100">手動コピー用全文</summary>
        <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-950 p-3 font-mono text-[11px] leading-relaxed text-gray-100">{app.copyText}</pre>
      </details>
    </article>
  )
}

export default function IosSigningGuidePage() {
  const apps = getIosSigningGuideApps()

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="iOS署名準備"
        guide="新しいiOSアプリをTestFlightへ送る前に、人間がApple Developer / App Store Connect / Codemagicへ入力する値をまとめたページです。TestFlight対象workflowだけを表示します。"
      />
      <SubTabBar items={APP_DEVELOPMENT_SUBTABS} />

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100">
        <h2 className="text-sm font-black">使い方</h2>
        <p className="mt-2 font-semibold">
          アプリカードごとに「このアプリの手順を全文コピー」を押すと、入力値つきの手順をまとめてコピーできます。各行のコピーは、入力欄へ貼る値だけをコピーします。
        </p>
        <p className="mt-2 font-semibold">
          CodemagicのReference nameはcodemagic.yamlと一致している必要があります。ここに出ている値と違う名前で登録すると、ビルドは署名profile未検出で失敗します。
        </p>
      </section>

      {apps.length === 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
          TestFlight対象workflowは見つかりませんでした。
        </section>
      ) : (
        <section className="space-y-4">
          {apps.map((app) => (
            <AppGuideCard key={app.id} app={app} />
          ))}
        </section>
      )}
    </main>
  )
}
