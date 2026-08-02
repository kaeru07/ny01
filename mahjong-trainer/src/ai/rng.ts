// 再現性のためのシード付き乱数（mulberry32）。
// 学習・評価を決定的に回せるようにする。

export type Rng = () => number

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n)
}

export function pick<T>(rng: Rng, arr: T[]): T {
  return arr[randInt(rng, arr.length)]
}

// engine 内部（shuffleDeck）が Math.random を使うため、指定シードで一時的に差し替える。
// これにより gameReducer をそのまま流用しつつ配牌を決定的にできる。
export function withSeededRandom<T>(rng: Rng, fn: () => T): T {
  const orig = Math.random
  Math.random = rng
  try {
    return fn()
  } finally {
    Math.random = orig
  }
}
