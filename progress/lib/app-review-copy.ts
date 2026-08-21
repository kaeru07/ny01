// App Store 審査提出用のコピーテキストを組み立てる純粋関数。
// サーバー（lib/app-review-fields.ts）とクライアント（入力欄の現在値からコピー）の
// 両方から使うため、node:fs などサーバー専用モジュールに依存させない。

export interface AppReviewCopyHeader {
  appName: string
  appPathLabel: string
  bundleId: string
}

export interface AppReviewCopyRow {
  label: string
  value: string
}

/** 未入力の項目も「未設定」として残す。App Store Connect 側の埋め漏れに気付けるようにするため。 */
export function buildAppReviewCopyText(header: AppReviewCopyHeader, rows: AppReviewCopyRow[]): string {
  return [
    `対象アプリ: ${header.appName}`,
    `作業場所: ${header.appPathLabel}`,
    `Bundle ID: ${header.bundleId}`,
    ...rows.map((row) => `${row.label}: ${row.value.trim() || '未設定'}`),
  ].join('\n')
}
