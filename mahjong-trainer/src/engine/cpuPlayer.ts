import type { GameState } from "@/types/game";
import type { TileIndex } from "@/types/mahjong";
import { calculateShanten, isWinningHand } from "@/domain/mahjong/shanten";
import { sortTiles } from "@/domain/mahjong/tile";

// ============================================================
// CPU打牌AI: 向聴数を最小化する牌を選んで打牌する
// ============================================================

// CPUが打牌すべき牌を選ぶ (14枚から1枚選択)
export function cpuSelectDiscard(
  hand: TileIndex[],
  drawnTile: TileIndex | null
): TileIndex {
  const fullHand = drawnTile !== null ? [...hand, drawnTile] : [...hand];

  // 和了できるなら和了 (ツモ和了) → discardはnullになるが今は簡略化
  if (isWinningHand(fullHand)) {
    // TODO: 和了処理を呼び出す。今はとりあえず孤立牌を捨てる
  }

  let bestShanten = 99;
  let bestDiscard = fullHand[0];

  const seen = new Set<TileIndex>();
  for (const tile of fullHand) {
    if (seen.has(tile)) continue;
    seen.add(tile);

    const remaining = fullHand.filter((t, i) => {
      if (t !== tile) return true;
      // 同じ牌が複数ある場合は最初の1枚だけ除外
      const idx = fullHand.indexOf(tile);
      return i !== idx;
    });

    const s = calculateShanten(remaining);
    if (s < bestShanten) {
      bestShanten = s;
      bestDiscard = tile;
    }
  }

  return bestDiscard;
}

// CPUターンを処理: drawしてdiscardする GameState を返す
export function processCpuTurn(
  state: GameState
): { discard: TileIndex; tsumoWin: boolean } {
  const player = state.players[state.turn];
  const drawnTile = player.drawnTile;

  const fullHand =
    drawnTile !== null ? [...player.hand, drawnTile] : [...player.hand];

  // 和了チェック
  if (drawnTile !== null && isWinningHand(fullHand)) {
    return { discard: drawnTile, tsumoWin: true };
  }

  const discard = cpuSelectDiscard(player.hand, drawnTile);
  return { discard, tsumoWin: false };
}
