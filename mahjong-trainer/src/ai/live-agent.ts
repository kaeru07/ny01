import type { GameState } from '@/types/game'
import type { PlayerIndex, TileIndex } from '@/types/mahjong'
import type { Observation } from './types'
import { isWinningHand } from '@/domain/mahjong/shanten'
import { WeightedAgent } from './agents'

// 学習した重み（プレイスタイル）で、実対局のCPU打牌を決める。
// これにより UI のフィードバックで育てたスタイルが今後の対局に反映される。

function observationForState(state: GameState, seat: PlayerIndex): Observation {
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

// 学習重みでCPUの手番を処理（ツモ和了判定 + 打牌選択）。
export function cpuTurnWithPolicy(
  state: GameState,
  weights: number[]
): { discard: TileIndex; tsumoWin: boolean } {
  const player = state.players[state.turn]
  const drawn = player.drawnTile

  if (drawn !== null && isWinningHand([...player.hand, drawn])) {
    return { discard: drawn, tsumoWin: true }
  }

  const obs = observationForState(state, state.turn)
  const discard = new WeightedAgent(weights).selectDiscard(obs)
  return { discard, tsumoWin: false }
}
