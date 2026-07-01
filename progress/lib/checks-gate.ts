// lint ゲートの中核純関数。依存ゼロ（node builtin も import しない）にして、
// node --test から直接 import して検証できるようにする（checks-runner.ts は runCommand を
// 介して実コマンドを叩くため、テスト時に重い依存・extensionless import を巻き込まないよう分離）。

// checks に NG（lint / typecheck / build 失敗）が含まれるかを判定する。
// ai-review.ts の NG_CHECK_PATTERN と同じ語彙に揃える（OK 以外で fail/ng/error 等）。
export const NG_CHECK_PATTERN = /\b(ng|fail|failed|error)\b|エラー|失敗|✗/i

/** checks の中で NG 判定されたキーを `key=value` で返す。NG が無ければ空配列。 */
export function failingChecks(checks: Record<string, string | undefined> | undefined): string[] {
  const hits: string[] = []
  for (const [key, value] of Object.entries(checks ?? {})) {
    if (typeof value !== 'string') continue
    if (NG_CHECK_PATTERN.test(value)) hits.push(`${key}=${value}`)
  }
  return hits
}

/**
 * lint ゲート: checks に NG がある Run を「完了扱い(completed)」にしない。
 * executor が completed を返しても、機械判定(lint / typecheck / build)が NG なら partial へ格下げする。
 * これにより lint NG の Run が doneCriteria 進捗や成功カウントに混ざらず、レビュー待ち(継続/要修正)へ回る。
 * completed 以外（partial / failed / running）はそのまま返す。
 */
export function gateRunStatusByChecks<T extends string>(
  runStatus: T,
  checks: Record<string, string | undefined> | undefined,
): T | 'partial' {
  if (runStatus === 'completed' && failingChecks(checks).length > 0) return 'partial'
  return runStatus
}
