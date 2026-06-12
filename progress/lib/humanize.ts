// タスク名・内部命名を人間語へ変換する共有ヘルパー。
// サーバ専用依存（fs等）を持たないため、command-center / factory-outlook の両方から import できる。

/** 内部の命名規則（Run一次レビュー: / epic-xxx / 次Epic候補 / Run / Factory 等）をタイトルから除く・人間語へ置換する。 */
export function humanizeTitle(title: string): string {
  let t = title
  // 「レビュー起点: おすすめ承認: レビュー起点: …」のような入れ子プレフィックスは安定するまで剥がす
  const prefixes = /^(Run一次レビュー|レビュー起点|おすすめ承認|Epic完了|epic[-_][\w-]+|Factory\(auto\))\s*[:：]\s*/i
  for (let i = 0; i < 6 && prefixes.test(t); i++) t = t.replace(prefixes, '')
  const patterns: Array<[RegExp, string]> = [
    // 「… の次Epic候補（既存Epicへ Next Action 追記） の次Epic候補 …」以降はすべてメタ情報
    [/\s*の次Epic候補[\s\S]*$/i, ''],
    [/\s*\((schedule|boot)\/[^)]*\)/gi, ''],
    // 内部IDはどこにあっても除去
    [/epic[-_][\w-]+[-_]?\s*/gi, ''],
    // 内部語の翻訳
    [/Factory\s*schedule/gi, 'AI工場の定期実行'],
    [/Factory/gi, 'AI工場'],
    [/失敗\s*Run/gi, '失敗した作業'],
    [/\bRuns?\b/g, '作業'],
    [/\bReview\b/gi, 'レビュー'],
  ]
  for (const [re, rep] of patterns) t = t.replace(re, rep)
  t = t.replace(/（\s*）|\(\s*\)/g, '').replace(/\s{2,}/g, ' ')
  t = t.trim().replace(/^[、。・:：\s]+/, '').replace(/[、。\s]+$/, '')
  const wrapped = t.match(/^（(.+)）$/) ?? t.match(/^\((.+)\)$/)
  if (wrapped) t = wrapped[1].trim()
  return t || title
}

/** タスク名から「何の話か」の主語を取り出す（補足括弧と末尾の作業動詞を落とす）。 */
export function subjectOf(clean: string): string {
  let s = clean.replace(/（[^）]*）|\([^)]*\)/g, '').trim()
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/(を|の)?(調査・修正|調査|修正|対応|改修|確認|改善|追加|実装|整備|を作る|作成)(する)?$/, '')
      .replace(/（[^）]*）$|\([^)]*\)$/, '')
      .replace(/[、。・\s]+$/, '')
      .trim()
  }
  return s || clean
}

export function shorten(s: string, n = 26): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
