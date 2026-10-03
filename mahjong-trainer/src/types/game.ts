import type { MeldType, Player, PlayerIndex, TileIndex, Wind } from "./mahjong";

export type GamePhase =
  | "idle"
  | "playing"
  | "ryukyoku"
  | "won"
  | "review";

export interface RoundInfo {
  wind: Wind;
  number: number;
  honba: number;
  turnCount: number;
}

export interface LastDiscard {
  player: PlayerIndex;
  tile: TileIndex;
  tsumogiri: boolean;
  riichi: boolean;
}

export interface HumanCallOptions {
  fromPlayer: PlayerIndex;
  tile: TileIndex;
  pon: boolean;
  kan: boolean;
  chi: TileIndex[][];
}

export interface GameState {
  phase: GamePhase;
  round: RoundInfo;
  turn: PlayerIndex;
  wall: TileIndex[];
  dora: TileIndex[];
  players: Player[];
  winner: PlayerIndex | null;
  winningTile: TileIndex | null;
  isPaused: boolean;
  gameLog: string[];
  startedAt: number;
  lastDiscard: LastDiscard | null;
  mustDiscard: boolean;
  riichiArmed: boolean;
  callPassed: boolean;
}

export type GameAction =
  | { type: "START_GAME" }
  | { type: "DRAW_TILE" }
  | { type: "DISCARD_TILE"; tileIndex: TileIndex; fromDrawn?: boolean }
  | { type: "DECLARE_RIICHI"; tileIndex: TileIndex; fromDrawn?: boolean }
  | { type: "ARM_RIICHI" }
  | { type: "CANCEL_RIICHI" }
  | {
      type: "CALL_MELD";
      caller: PlayerIndex;
      meldType: Extract<MeldType, "chi" | "pon" | "kan">;
      tilesFromHand: TileIndex[];
    }
  | { type: "PASS_CALL" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "START_REVIEW" }
  | { type: "NEXT_ROUND" };
