import type { ExecutorResult } from './executors/types'

// ─────────────────────────────────────────────────────────────
// 空振り Run の判定。
//
// executor が「（出力なし）」で終わった Run が completed として記録され、
// 作業予約も完了扱いになっていた（2026-08-22 / runId 20260822-160657-718）。
// 回った回数が成果と一致しなくなり、優先順位の判断材料が濁るため、
// 変更も出力も無い Run は完了にしない。
// ─────────────────────────────────────────────────────────────

/** executor が何も返さなかったことを示す文言。adapter 側の定型文に合わせる。 */
const NO_OUTPUT_PATTERN = /出力なし|no output|empty output/i

export interface NoOpVerdict {
  isNoOp: boolean
  reason: string
}

/**
 * 「実質何もしていない Run」かどうかを判定する。
 * 変更ファイルが1件でもある、または本文のある出力が返っていれば空振りではない。
 * failed は別経路（失敗）で扱うのでここでは空振りにしない。
 */
export function classifyNoOpRun(result: Pick<ExecutorResult, 'status' | 'stdout' | 'resultSummary' | 'changedFiles'>): NoOpVerdict {
  if (result.status === 'failed') return { isNoOp: false, reason: '失敗は別扱い' }
  if ((result.changedFiles?.length ?? 0) > 0) return { isNoOp: false, reason: '変更ファイルあり' }

  const stdout = (result.stdout ?? '').trim()
  const summary = (result.resultSummary ?? '').trim()

  if (stdout.length > 0) return { isNoOp: false, reason: '出力あり' }
  if (summary && !NO_OUTPUT_PATTERN.test(summary)) return { isNoOp: false, reason: '要約あり' }

  return {
    isNoOp: true,
    reason: summary
      ? `変更ファイル0件かつ executor の出力なし（${summary}）`
      : '変更ファイル0件かつ executor の出力なし',
  }
}
