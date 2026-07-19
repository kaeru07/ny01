// Executor 適格性ポリシー（Claude→Codex 自動切替の共有判定・純粋関数）。
// operations-store から再 export され、dispatch 判定と codex adapter の二重ゲートが同一実装を共有する。

/** Codex へ渡してよい安全シグナル（方針決定済み・非破壊作業） */
export const CODEX_ALLOW_SIGNALS = [
  'lint', 'typecheck', 'type check', 'build', 'test', 'テスト', 'document', 'docs', 'ドキュメント',
  'vault', 'integ', 'issue', 'ui', 'copy', '文言', 'リファクタ', '整理', 'スタイル', 'format',
]

/** Codex へ渡さない危険シグナル（Claude 専任 / 人間判断が必要） */
export const CODEX_DENY_SIGNALS = [
  '課金', 'billing', '本番db', 'production db', '本番', 'destructive', '削除', 'drop ', 'truncate',
  'secret', 'token', '認証', 'credential', '外部公開', 'publish', 'deploy', 'デプロイ',
  'pm2', 'cron', 'systemd', 'migration', 'マイグレーション', 'スキーマ変更', '.env',
]

// 「課金/本番/認証/破壊/外部公開の安全ゲートは維持」のような列挙は、危険作業の指示ではなく
// 守るべき制約の再掲。deny 判定前にこの列挙部分だけを取り除き、誤検知で Codex fallback が
// requires_claude に倒れるのを防ぐ（runId 20260711-140030-019 の停止原因）。
// 「安全ゲートを維持しながら課金APIを実装」のような文は列挙形でないため除去されず、deny のまま。
const SAFETY_GATE_MENTION_RE = /[^\s。、]+(?:[/・][^\s。、]+)*の安全ゲート(?:は|を)?維持/g

export interface CodexEligibility {
  eligible: boolean
  reason: string
}

/** テキストから Codex 自動切替の可否を判定する（最終ゲートは requiresClaude / Approval Queue）。 */
export function classifyCodexEligibility(text: string): CodexEligibility {
  const t = text.replace(SAFETY_GATE_MENTION_RE, ' ').toLowerCase()
  const deny = CODEX_DENY_SIGNALS.find((s) => t.includes(s))
  if (deny) return { eligible: false, reason: `危険シグナル「${deny}」を含むため Claude 専任` }
  const allow = CODEX_ALLOW_SIGNALS.find((s) => t.includes(s))
  if (allow) return { eligible: true, reason: `安全シグナル「${allow}」に該当` }
  return { eligible: false, reason: '安全シグナル未検出のため既定で Claude' }
}
