import { GameState, GameAction, GamePhase, RoundInfo } from "@/types/game";
import { Player, PlayerIndex, Wind, TileIndex } from "@/types/mahjong";
import { createDeck, shuffleDeck, sortTiles } from "@/domain/mahjong/tile";
import { calculateShanten, isWinningHand, isTenpai } from "@/domain/mahjong/shanten";

const WINDS: Wind[] = ["east", "south", "west", "north"];
const INITIAL_SCORE = 25000;

// ============================================================
// 初期化
// ============================================================

function createPlayer(index: PlayerIndex, wind: Wind): Player {
  return {
    index,
    wind,
    hand: [],
    drawnTile: null,
    discards: [],
    melds: [],
    score: INITIAL_SCORE,
    riichi: false,
    tenpai: false,
  };
}

export function createInitialState(): GameState {
  return {
    phase: "idle",
    round: { wind: "east", number: 1, honba: 0, turnCount: 0 },
    turn: 0,
    wall: [],
    dora: [],
    players: [0, 1, 2, 3].map((i) =>
      createPlayer(i as PlayerIndex, WINDS[i])
    ),
    winner: null,
    winningTile: null,
    isPaused: false,
    gameLog: [],
    startedAt: Date.now(),
  };
}

function initRound(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());

  // ドラ表示牌: デッキの末尾5枚を使用 (簡略化)
  const dora = [deck[135]];
  const wall = deck.slice(0, 136 - 14 - 1); // 配牌後の残り山

  // 配牌: 各プレイヤーに13枚
  const hands: TileIndex[][] = [[], [], [], []];
  const dealDeck = deck.slice(0, 52); // 4×13 = 52枚
  for (let round = 0; round < 13; round++) {
    for (let p = 0; p < 4; p++) {
      hands[p].push(dealDeck[round * 4 + p]);
    }
  }

  // 残り山
  const remainingWall = deck.slice(52);

  // 東家 (index=0) の最初のツモ
  const firstDraw = remainingWall.shift()!;

  const players = state.players.map((p, i) => ({
    ...p,
    hand: sortTiles(hands[i]),
    drawnTile: i === 0 ? firstDraw : null,
    discards: [],
    melds: [],
    riichi: false,
    tenpai: false,
  }));

  return {
    ...state,
    phase: "playing",
    turn: 0,
    wall: remainingWall,
    dora,
    players,
    winner: null,
    winningTile: null,
    isPaused: false,
    round: { ...state.round, turnCount: 0 },
    gameLog: ["対局開始！東家: あなた"],
    startedAt: Date.now(),
  };
}

// ============================================================
// ゲームリデューサー
// ============================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME":
      return initRound(createInitialState());

    case "NEXT_ROUND":
      return initRound({
        ...state,
        round: {
          ...state.round,
          number: state.round.number + 1,
          honba: state.winner !== null ? 0 : state.round.honba + 1,
        },
      });

    case "DRAW_TILE": {
      if (state.wall.length === 0) {
        return { ...state, phase: "ryukyoku" };
      }
      const newWall = [...state.wall];
      const drawn = newWall.shift()!;
      const players = state.players.map((p) =>
        p.index === state.turn ? { ...p, drawnTile: drawn } : p
      );
      const log = [
        ...state.gameLog,
        `${playerLabel(state.turn)} ツモ`,
      ];
      return {
        ...state,
        wall: newWall,
        players,
        gameLog: log,
        round: { ...state.round, turnCount: state.round.turnCount + 1 },
      };
    }

    case "DISCARD_TILE": {
      const player = state.players[state.turn];
      const tileIndex = action.tileIndex;

      // ドローした牌か手牌かを判断してdiscardに追加
      let newHand: TileIndex[];
      if (player.drawnTile === tileIndex) {
        newHand = [...player.hand];
      } else {
        const pos = player.hand.indexOf(tileIndex);
        newHand = player.hand.filter((_, i) => i !== pos);
      }

      const fullHand = player.drawnTile !== null
        ? [...player.hand, player.drawnTile]
        : [...player.hand];

      // 和了チェック: 自分が和了できるか (ツモ和了)
      const allTiles = [...player.hand, ...(player.drawnTile !== null ? [player.drawnTile] : [])];
      const isTsumo = isWinningHand(allTiles);

      const updatedPlayer: Player = {
        ...player,
        hand: sortTiles(newHand),
        drawnTile: null,
        discards: [...player.discards, tileIndex],
        tenpai: isTenpai(newHand),
      };

      const players = state.players.map((p) =>
        p.index === state.turn ? updatedPlayer : p
      );

      const nextTurn = ((state.turn + 1) % 4) as PlayerIndex;
      const log = [
        ...state.gameLog,
        `${playerLabel(state.turn)} ${tileIndex}を打牌`,
      ];

      return {
        ...state,
        players,
        turn: nextTurn,
        gameLog: log,
      };
    }

    case "DECLARE_RIICHI": {
      // TODO: 立直宣言の完全実装
      const player = state.players[state.turn];
      const tileIndex = action.tileIndex;
      const newHand = player.hand.filter((t) => t !== tileIndex);
      const updatedPlayer: Player = {
        ...player,
        hand: sortTiles(newHand),
        drawnTile: null,
        discards: [...player.discards, tileIndex],
        riichi: true,
        tenpai: true,
        score: player.score - 1000,
      };
      const players = state.players.map((p) =>
        p.index === state.turn ? updatedPlayer : p
      );
      const nextTurn = ((state.turn + 1) % 4) as PlayerIndex;
      return {
        ...state,
        players,
        turn: nextTurn,
        gameLog: [...state.gameLog, `${playerLabel(state.turn)} リーチ！`],
      };
    }

    case "PAUSE":
      return { ...state, isPaused: true };

    case "RESUME":
      return { ...state, isPaused: false };

    case "START_REVIEW":
      return { ...state, phase: "review" };

    default:
      return state;
  }
}

// ============================================================
// ユーティリティ
// ============================================================

export function playerLabel(index: PlayerIndex): string {
  return ["あなた(東)", "CPU南", "CPU西", "CPU北"][index];
}

// 自摸和了判定 (現在のプレイヤーが14枚で和了できるか)
export function checkTsumoWin(state: GameState): boolean {
  const player = state.players[state.turn];
  if (player.drawnTile === null) return false;
  return isWinningHand([...player.hand, player.drawnTile]);
}

// 山が尽きたか
export function isWallEmpty(state: GameState): boolean {
  return state.wall.length === 0;
}
