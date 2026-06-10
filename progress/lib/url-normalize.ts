// URL 文字列の正規化（クライアント / サーバー両用・fs 依存なし）。
//
// アプリURL一覧でユーザーが手入力した URL を「リンクとして開ける正規 URL」へ整える。
// この関数はクライアントコンポーネント（入力フォームの onBlur）とサーバー（保存API）の
// 両方から使うため、副作用・Node 依存を持たない純粋関数として独立させている。

/**
 * 入力された URL 文字列を canonical な URL へ整える。
 * - 空 / '未確認' はそのまま '未確認'
 * - スキーム（http:// https://）が無ければ補う
 *   - localhost / IP（:port 可）は http、それ以外のドメインは https を既定にする
 * - protocol-relative（//host…）は https: を補う
 * - 最終的に URL として解釈できれば canonical な href を返す（解釈不能なら補正後の文字列）
 *
 * 例: "example.com/foo"            -> "https://example.com/foo"
 *     "160.251.143.146:3010/app"   -> "http://160.251.143.146:3010/app"
 *     "https://a.com"              -> "https://a.com/"
 */
export function normalizeUrlString(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s || s === '未確認') return '未確認'

  let candidate = s
  if (!/^https?:\/\//i.test(candidate)) {
    if (candidate.startsWith('//')) {
      candidate = `https:${candidate}`
    } else {
      const hostOnly = candidate.split('/')[0].split(':')[0].toLowerCase()
      const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)
      const isLocal = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostOnly)
      candidate = `${isIp || isLocal ? 'http' : 'https'}://${candidate}`
    }
  }
  try {
    return new URL(candidate).href
  } catch {
    return candidate
  }
}
