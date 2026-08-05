import type { TileIndex } from '@/types/mahjong'
import { doraFromIndicator, featureVector, handFeatures } from './features'
import { FEATURE_DIM } from './features'

// UI からのフィードバックで重み（プレイスタイル）を更新する学習コア。
//
// 好みベースの学習（パーセプトロン更新）:
//   ユーザーが「本当はこの牌を切るべき」と選ぶと、その打牌の評価が
//   AIが選んだ打牌より高くなる方向に重みを動かす。フィードバックを重ねると
//   ユーザーの好み＝プレイスタイルが重みに蓄積され、今後の打牌に反映される。

function handAfterDiscard(fullHand: TileIndex[], discard: TileIndex): TileIndex[] {
  const i = fullHand.indexOf(discard)
  return fullHand.filter((_, j) => j !== i)
}

function featForDiscard(fullHand: TileIndex[], doraIndicators: TileIndex[], discard: TileIndex): number[] {
  const dora = doraIndicators.map(doraFromIndicator)
  return featureVector(handFeatures(handAfterDiscard(fullHand, discard), dora))
}

export interface PreferenceFeedback {
  fullHand: TileIndex[]
  doraIndicators: TileIndex[]
  chosen: TileIndex      // AI が切った牌
  preferred: TileIndex   // ユーザーが「本当はこれ」とした牌
}

const LR = 0.35 // 学習率

// 「preferred の評価 > chosen の評価」となるよう重みを1ステップ更新する。
export function applyPreference(weights: number[], fb: PreferenceFeedback): number[] {
  if (fb.preferred === fb.chosen) return weights.slice()
  const xPref = featForDiscard(fb.fullHand, fb.doraIndicators, fb.preferred)
  const xChosen = featForDiscard(fb.fullHand, fb.doraIndicators, fb.chosen)
  // w += lr * (x_preferred - x_chosen)
  return weights.map((w, i) => w + LR * (xPref[i] - xChosen[i]))
}

// 「今の打牌で良い」= AI の選択を弱く強化（現状維持を後押し）。
// 現状の chosen を、次点候補より少しだけ高く評価する方向へ微更新する。
export function applyApproval(weights: number[], fb: Omit<PreferenceFeedback, 'preferred'> & { runnerUp?: TileIndex }): number[] {
  if (fb.runnerUp === undefined || fb.runnerUp === fb.chosen) return weights.slice()
  const xChosen = featForDiscard(fb.fullHand, fb.doraIndicators, fb.chosen)
  const xOther = featForDiscard(fb.fullHand, fb.doraIndicators, fb.runnerUp)
  return weights.map((w, i) => w + (LR * 0.5) * (xChosen[i] - xOther[i]))
}

// 粗いスタイル調整（UI のボタン用）。特徴の重みを直接ナッジする。
export type StyleAxis = 'speed' | 'value' | 'width' | 'tidiness'

const AXIS_INDEX: Record<StyleAxis, number> = {
  speed: 0,     // -向聴の重み
  value: 2,     // ドラの重み
  width: 1,     // 待ち数の重み
  tidiness: 3,  // 孤立ペナルティの重み（大きいほど孤立を嫌う）
}

export function nudgeStyle(weights: number[], axis: StyleAxis, delta: number): number[] {
  const idx = AXIS_INDEX[axis]
  const out = weights.slice()
  if (idx < FEATURE_DIM) out[idx] += delta
  return out
}
