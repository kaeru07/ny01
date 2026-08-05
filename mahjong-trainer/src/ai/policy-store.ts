import { HAND_TUNED_WEIGHTS } from './agents'
import { FEATURE_DIM } from './features'

// 学習した重み（プレイスタイル）を端末内に永続化する。
// アプリは静的エクスポート（サーバなし）なので localStorage で完結させる。
// ここに保存した重みが「AIの今後のプレイスタイル」になる。

const KEY = 'mahjong-ai-policy-v1'

export interface PolicyProfile {
  weights: number[]
  feedbackCount: number   // 学習に使ったフィードバック数
  updatedAt: number
}

export function defaultProfile(): PolicyProfile {
  return { weights: HAND_TUNED_WEIGHTS.slice(), feedbackCount: 0, updatedAt: Date.now() }
}

export function loadProfile(): PolicyProfile {
  if (typeof window === 'undefined') return defaultProfile()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return defaultProfile()
    const p = JSON.parse(raw) as PolicyProfile
    if (!Array.isArray(p.weights) || p.weights.length !== FEATURE_DIM) return defaultProfile()
    return { weights: p.weights, feedbackCount: p.feedbackCount ?? 0, updatedAt: p.updatedAt ?? Date.now() }
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(p: PolicyProfile): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...p, updatedAt: Date.now() }))
  } catch {
    /* 容量超過等は無視（学習は次回も続けられる） */
  }
}

export function resetProfile(): PolicyProfile {
  const p = defaultProfile()
  saveProfile(p)
  return p
}

// 重み → 人が読めるプレイスタイル指標（0〜100）。UI 表示用。
export interface StyleMeters {
  speed: number       // スピード（テンパイ優先）
  value: number       // 打点（ドラ重視）
  width: number       // 受けの広さ（待ち・対子）
  tidiness: number    // 整理・安全（孤立牌を嫌う）
}

function scale(v: number, lo: number, hi: number): number {
  return Math.round(Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)))
}

export function styleMeters(weights: number[]): StyleMeters {
  const [negShanten, waits, dora, isolated, pair] = weights
  return {
    speed: scale(negShanten, 0, 8),
    value: scale(dora, -1, 4),
    width: scale(waits + pair, -1, 5),
    tidiness: scale(-isolated, -2, 4),
  }
}
