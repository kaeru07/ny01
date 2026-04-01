import { Player, PlayerIndex, TileIndex, Wind } from "./mahjong";

export type GamePhase =
  | "idle"     // 開始前
  | "playing"  // 対局中
  | "ryukyoku" // 流局
  | "won"      // 和了
  | "review";  // 局後レビュー

export interface RoundInfo {
  wind: Wind;
  number: number; // 1-4
  honba: number;
  turnCount: number; // 合計ツモ数
}

export interface GameState {
  phase: GamePhase;
  round: RoundInfo;
  turn: PlayerIndex;         // 現在の手番
  wall: TileIndex[];         // 山牌
  dora: TileIndex[];         // ドラ表示牌
  players: Player[];
  winner: PlayerIndex | null;
  winningTile: TileIndex | null;
  isPaused: boolean;         // 読みモードで一時停止中
  gameLog: string[];
  startedAt: number;
}

export type GameAction =
  | { type: "START_GAME" }
  | { type: "DRAW_TILE" }
  | { type: "DISCARD_TILE"; tileIndex: TileIndex }
  | { type: "DECLARE_RIICHI"; tileIndex: TileIndex }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "START_REVIEW" }
  | { type: "NEXT_ROUND" };
