// 「今日の判断」6分類のラベル定義。
// クライアントコンポーネントからも import するため、サーバ専用依存（fs等）を持つ
// command-center.ts から分離している。値の正本はここ。

/** 画面上の5分類 + AI保留（カード非表示・件数のみ）。「人間が何を判断するか」で分類する。 */
export type InboxCardKind = 'danger' | 'acceptance' | 'direction' | 'permission' | 'human_task'

export const KIND_CHIP_LABEL: Record<InboxCardKind, string> = {
  danger: '危険判断',
  acceptance: '検収',
  direction: '方針選択',
  permission: '実行許可',
  human_task: '人間作業',
}
