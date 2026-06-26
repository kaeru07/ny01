import { CODEX_DENY_SIGNALS, classifyCodexEligibility } from './operations-store'

// AI実行者の役割分担と「危険操作は承認キューへ回す」安全ルールの単一正本。
//
// 背景: 危険操作を弾く判定がリポジトリ内で複数箇所に重複していた
//   - review-fix-runner.ts の HARD_DENY_PATTERN（正規表現）
//   - operations-store.ts の CODEX_DENY_SIGNALS（Codex 自動切替ゲート）
//   - command-center.ts の DANGER_CATEGORIES / ai-review.ts のパターン表
// これらが少しずつ食い違うと「あるゲートは通すが別ゲートは弾く」ズレが生まれ、
// 危険操作が自動実行に滑り込むリスクがある。Goal「AI実行者の役割分担と安全運用」の
// 第一歩として、役割定義と危険→承認の判定をこのモジュールに集約する。

/** Progress が認識する AI 実行者の役割。 */
export type AiExecutorRole = 'claude' | 'codex' | 'chatgpt' | 'fable' | 'manual'

export interface ExecutorRoleDef {
  role: AiExecutorRole
  /** 画面・ログに出す人間語ラベル。 */
  label: string
  /** 担当範囲（何をするか）。 */
  responsibility: string
  /** 実コード変更を伴う自動実行をしてよいか（true=実行系 / false=レビュー・人手系）。 */
  canAutoExecute: boolean
  /**
   * 危険操作（課金/本番DB/認証/secret/deploy/destructive 等）を自分で実行してよいか。
   * 全ロール false。危険操作は必ず承認キュー（Inbox 危険判断）へ回す。
   */
  handlesDangerousOps: false
}

/**
 * AI実行者の役割を固定する正本テーブル。
 * - 実行系: Claude Code（基本実行者）/ Codex（安全シグナル限定のフォールバック実行者）
 * - レビュー系: ChatGPT / Fable・Opus（レビュー用コピーを貼って検収・指摘する）
 * - 人手系: manual（AIでは実行できないストア公開・課金設定・契約など）
 * どのロールも危険操作は直接実行しない（handlesDangerousOps=false）。
 */
export const EXECUTOR_ROLES: Record<AiExecutorRole, ExecutorRoleDef> = {
  claude: {
    role: 'claude',
    label: 'Claude Code（基本実行者）',
    responsibility: '方針確定済みタスクの実装・調査・検証を非対話で実行する。上限検知時は Codex へフォールバック。',
    canAutoExecute: true,
    handlesDangerousOps: false,
  },
  codex: {
    role: 'codex',
    label: 'Codex（フォールバック実行者）',
    responsibility: '安全シグナル（lint/build/test/docs/UI 文言 等）に限定した非破壊作業を実行する。危険シグナルを含む作業は Claude 専任。',
    canAutoExecute: true,
    handlesDangerousOps: false,
  },
  chatgpt: {
    role: 'chatgpt',
    label: 'ChatGPT（レビュアー）',
    responsibility: 'レビュー用コピー / GitHub 経由で作業結果を検収し、指摘を返す。実コードの自動変更はしない。',
    canAutoExecute: false,
    handlesDangerousOps: false,
  },
  fable: {
    role: 'fable',
    label: 'Fable・Opus（レビュアー）',
    responsibility: 'レビュー用コピーを受け取り、方針・設計の妥当性を確認する。指摘は人間が Inbox へ起票する。',
    canAutoExecute: false,
    handlesDangerousOps: false,
  },
  manual: {
    role: 'manual',
    label: '人間作業（manual）',
    responsibility: 'ストア公開・課金設定・契約・本人確認など、AIでは実行できない作業を人間が行う。',
    canAutoExecute: false,
    handlesDangerousOps: false,
  },
}

/**
 * 危険操作の hard-deny パターン（承認キュー経由でのみ許可・AI 自動実行は禁止）。
 * review-fix-runner.ts の旧 HARD_DENY_PATTERN と同一定義をここへ集約した正本。
 * Codex 自動切替ゲート（CODEX_DENY_SIGNALS）とは目的が異なるため別管理だが、
 * 双方を routesToApprovalQueue() で AND 評価し「どちらかが危険判定なら承認へ回す」。
 */
export const APPROVAL_REQUIRED_PATTERN =
  /課金|billing|deploy|デプロイ|本番|production|secret|\.env|認証|migration|マイグレーション|削除|destructive|force/i

export interface ApprovalRouting {
  /** 危険操作のため自動実行不可（承認キューへ回す）か。 */
  routes: boolean
  /** 危険判定の理由（routes=true のときのみ）。 */
  reason: string | null
  /** 一致した危険シグナル語（あれば）。 */
  matched: string | null
}

/**
 * テキストが危険操作を含み、自動実行ではなく承認キュー（人間の危険判断）へ回すべきかを判定する。
 * hard-deny パターンと Codex 危険シグナルの両方を評価し、どちらかが危険なら承認へ回す。
 */
export function routesToApprovalQueue(text: string): ApprovalRouting {
  const hard = text.match(APPROVAL_REQUIRED_PATTERN)?.[0]
  if (hard) {
    return { routes: true, reason: `危険シグナル「${hard}」を含むため自動実行不可`, matched: hard }
  }
  const verdict = classifyCodexEligibility(text)
  if (!verdict.eligible && verdict.reason.includes('危険シグナル')) {
    return { routes: true, reason: `${verdict.reason}。自動実行不可`, matched: null }
  }
  return { routes: false, reason: null, matched: null }
}

// 参照のため再エクスポート（危険シグナル一覧の正本は operations-store 側）。
export { CODEX_DENY_SIGNALS }
