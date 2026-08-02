import type { GameState } from '@/types/game'
import type { PlayerIndex, TileIndex } from '@/types/mahjong'
import type { Agent, GameResult, Observation } from './types'
// 値としての import は下（型のみのものは上で import type 済み）
import { createInitialState, gameReducer } from '@/engine/gameEngine'
import { calculateShanten, isTenpai, isWinningHand } from '@/domain/mahjong/shanten'
import { withSeededRandom, type Rng } from './rng'

// ── 既存の gameReducer を流用したヘッドレス麻雀環境 ──────────────
// UI を介さず、4人のエージェントで1局を最後まで打つ。
// 現行エンジンの制約に従い「鳴きなし・ツモ和了のみ・点数計算なし」の簡易麻雀。
// AI 育成の土台としてはこの簡易環境で十分（後で鳴き/ロン/得点へ拡張可能）。

const MAX_STEPS = 200

function observationFor(state: GameState, seat: PlayerIndex): Observation {
  const p = state.players[seat]
  const drawn = p.drawnTile as TileIndex
  return {
    seat,
    hand: [...p.hand],
    drawnTile: drawn,
    fullHand: [...p.hand, drawn],
    discards: state.players.map((q) => [...q.discards]),
    dora: [...state.dora],
    turnCount: state.round.turnCount,
    wallCount: state.wall.length,
  }
}

// 1局を最後まで打って結果を返す。agents[0..3] が席 0..3 を担当。
export function playGame(agents: Agent[], rng: Rng): GameResult {
  if (agents.length !== 4) throw new Error('agents must have length 4')

  // 配牌のみ乱数（engine 内 shuffleDeck）。シード付きで決定的にする。
  let state = withSeededRandom(rng, () =>
    gameReducer(createInitialState(), { type: 'START_GAME' })
  )

  let winner: PlayerIndex | null = null
  let winningTile: TileIndex | null = null

  for (let step = 0; step < MAX_STEPS; step++) {
    if (state.phase !== 'playing') break

    const seat = state.turn
    const player = state.players[seat]

    // まだツモっていなければツモる（山切れなら reducer が ryukyoku にする）
    if (player.drawnTile === null) {
      state = gameReducer(state, { type: 'DRAW_TILE' })
      if (state.phase !== 'playing') break
    }

    const cur = state.players[state.turn]
    const drawn = cur.drawnTile
    if (drawn === null) break

    // ツモ和了判定（現行エンジンは役なし・形のみ）
    if (isWinningHand([...cur.hand, drawn])) {
      winner = state.turn
      winningTile = drawn
      break
    }

    // エージェントに打牌を選ばせる
    const obs = observationFor(state, state.turn)
    let discard = agents[state.turn].selectDiscard(obs)
    if (!obs.fullHand.includes(discard)) discard = drawn // 不正時はツモ切り
    state = gameReducer(state, { type: 'DISCARD_TILE', tileIndex: discard })
  }

  const finalShanten = state.players.map((p) => calculateShanten(p.hand))
  return {
    winner,
    winningTile,
    turns: state.round.turnCount,
    finalShanten,
    ryukyoku: winner === null,
  }
}

// 局終了時に各家がテンパイだったか（流局時の評価用）。
export function tenpaiFlags(result: GameResult): boolean[] {
  return result.finalShanten.map((s) => s === 0)
}

// 補助: 手牌13枚のテンパイ判定（外部から使いやすいように再エクスポート）
export function handIsTenpai(hand: TileIndex[]): boolean {
  return isTenpai(hand)
}
