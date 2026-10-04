import type {
  GameState,
  GameAction,
  HumanCallOptions,
  LastDiscard,
} from "@/types/game";
import type { Player, PlayerIndex, Wind, TileIndex } from "@/types/mahjong";
import { createDeck, shuffleDeck, sortTiles } from "@/domain/mahjong/tile";
import {
  getEffectiveDiscards,
  isWinningHand,
  isTenpai,
} from "@/domain/mahjong/shanten";

const WINDS: Wind[] = ["east", "south", "west", "north"];
const INITIAL_SCORE = 25000;

function createPlayer(index: PlayerIndex, wind: Wind): Player {
  return {
    index,
    wind,
    hand: [],
    drawnTile: null,
    discards: [],
    discardRecords: [],
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
    players: [0, 1, 2, 3].map((i) => createPlayer(i as PlayerIndex, WINDS[i])),
    winner: null,
    winningTile: null,
    isPaused: false,
    gameLog: [],
    startedAt: Date.now(),
    lastDiscard: null,
    mustDiscard: false,
    riichiArmed: false,
    callPassed: false,
  };
}

function initRound(state: GameState): GameState {
  const deck = shuffleDeck(createDeck());
  const dora = [deck[135]];
  const hands: TileIndex[][] = [[], [], [], []];
  const dealDeck = deck.slice(0, 52);

  for (let round = 0; round < 13; round++) {
    for (let p = 0; p < 4; p++) hands[p].push(dealDeck[round * 4 + p]);
  }

  const remainingWall = deck.slice(52);
  const firstDraw = remainingWall.shift()!;
  const players = state.players.map((p, i) => ({
    ...p,
    hand: sortTiles(hands[i]),
    drawnTile: i === 0 ? firstDraw : null,
    discards: [],
    discardRecords: [],
    melds: [],
    riichi: false,
    tenpai: false,
    score: state.phase !== "idle" ? p.score : INITIAL_SCORE,
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
    lastDiscard: null,
    mustDiscard: false,
    riichiArmed: false,
    callPassed: false,
  };
}

function removeOne(hand: TileIndex[], tile: TileIndex): TileIndex[] | null {
  const index = hand.indexOf(tile);
  if (index < 0) return null;
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

function removeMany(hand: TileIndex[], tiles: TileIndex[]): TileIndex[] | null {
  let next = [...hand];
  for (const tile of tiles) {
    const removed = removeOne(next, tile);
    if (!removed) return null;
    next = removed;
  }
  return next;
}

function resolveDiscardSource(player: Player, tileIndex: TileIndex, fromDrawn?: boolean) {
  if (fromDrawn === true) return "drawn" as const;
  if (fromDrawn === false) return "hand" as const;
  // Legacy actions (existing tests / CPU): prefer a hand tile when present.
  if (player.hand.includes(tileIndex)) return "hand" as const;
  return "drawn" as const;
}

function applyDiscard(
  state: GameState,
  tileIndex: TileIndex,
  fromDrawn: boolean | undefined,
  riichi: boolean
): GameState {
  const player = state.players[state.turn];
  const source = resolveDiscardSource(player, tileIndex, fromDrawn);
  let newHand = [...player.hand];

  if (source === "drawn") {
    if (player.drawnTile === null || player.drawnTile !== tileIndex) return state;
  } else {
    const removed = removeOne(player.hand, tileIndex);
    if (!removed) return state;
    newHand = player.drawnTile !== null ? [...removed, player.drawnTile] : removed;
  }

  const sortedHand = sortTiles(newHand);
  const record = { tile: tileIndex, tsumogiri: source === "drawn", riichi };
  const updatedPlayer: Player = {
    ...player,
    hand: sortedHand,
    drawnTile: null,
    discards: [...player.discards, tileIndex],
    discardRecords: [...player.discardRecords, record],
    riichi: riichi || player.riichi,
    tenpai: isTenpai(sortedHand),
    score: riichi && !player.riichi ? player.score - 1000 : player.score,
  };

  const players = state.players.map((p) => (p.index === state.turn ? updatedPlayer : p));
  const nextTurn = ((state.turn + 1) % 4) as PlayerIndex;
  const lastDiscard: LastDiscard = {
    player: state.turn,
    tile: tileIndex,
    tsumogiri: source === "drawn",
    riichi,
  };

  return {
    ...state,
    players,
    turn: nextTurn,
    lastDiscard,
    mustDiscard: false,
    riichiArmed: false,
    callPassed: false,
    gameLog: [
      ...state.gameLog,
      `${playerLabel(state.turn)} ${riichi ? "立直・" : ""}${source === "drawn" ? "ツモ切り" : "手出し"} ${tileIndex}`,
    ],
  };
}

function possibleChiPairs(hand: TileIndex[], tile: TileIndex): TileIndex[][] {
  if (tile >= 27) return [];
  const base = Math.floor(tile / 9) * 9;
  const rank = tile - base;
  const candidates = [
    [tile - 2, tile - 1],
    [tile - 1, tile + 1],
    [tile + 1, tile + 2],
  ];

  return candidates.filter((pair) => {
    if (pair.some((t) => t < base || t >= base + 9)) return false;
    if (rank <= 1 && pair[0] < base) return false;
    if (rank >= 7 && pair[1] >= base + 9) return false;
    let copy = [...hand];
    for (const t of pair) {
      const next = removeOne(copy, t);
      if (!next) return false;
      copy = next;
    }
    return true;
  });
}

export function getHumanCallOptions(state: GameState): HumanCallOptions | null {
  const last = state.lastDiscard;
  const human = state.players[0];
  if (
    state.phase !== "playing" ||
    state.isPaused ||
    state.callPassed ||
    !last ||
    last.player === 0 ||
    human.riichi ||
    human.drawnTile !== null ||
    state.mustDiscard
  ) {
    return null;
  }

  const count = human.hand.filter((t) => t === last.tile).length;
  const chi = last.player === 3 ? possibleChiPairs(human.hand, last.tile) : [];
  if (count < 2 && chi.length === 0) return null;

  return {
    fromPlayer: last.player,
    tile: last.tile,
    pon: count >= 2,
    kan: count >= 3,
    chi,
  };
}

export function canDeclareRiichi(state: GameState, playerIndex: PlayerIndex = state.turn): boolean {
  const player = state.players[playerIndex];
  if (
    state.phase !== "playing" ||
    state.turn !== playerIndex ||
    player.riichi ||
    player.score < 1000 ||
    player.drawnTile === null ||
    player.melds.length > 0
  ) {
    return false;
  }
  return getEffectiveDiscards([...player.hand, player.drawnTile]).some((entry) => entry.shanten === 0);
}

export function canRiichiWithDiscard(
  state: GameState,
  tileIndex: TileIndex,
  fromDrawn?: boolean,
  playerIndex: PlayerIndex = state.turn
): boolean {
  if (!canDeclareRiichi(state, playerIndex)) return false;
  const player = state.players[playerIndex];
  const source = resolveDiscardSource(player, tileIndex, fromDrawn);
  let remaining = [...player.hand];
  if (source === "drawn") {
    if (player.drawnTile !== tileIndex) return false;
  } else {
    const removed = removeOne(player.hand, tileIndex);
    if (!removed) return false;
    remaining = player.drawnTile !== null ? [...removed, player.drawnTile] : removed;
  }
  return isTenpai(sortTiles(remaining));
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "START_GAME":
      return initRound(createInitialState());

    case "NEXT_ROUND":
      return initRound({
        ...state,
        round: {
          ...state.round,
          number: state.round.number >= 4 ? 1 : state.round.number + 1,
          wind: state.round.number >= 4 ? "south" : state.round.wind,
          honba: state.winner !== null ? 0 : state.round.honba + 1,
        },
      });

    case "DRAW_TILE": {
      if (state.wall.length === 0) return { ...state, phase: "ryukyoku" };
      if (state.mustDiscard) return state;
      const current = state.players[state.turn];
      if (current.drawnTile !== null) return state;
      const newWall = [...state.wall];
      const drawn = newWall.shift()!;
      const players = state.players.map((p) => (p.index === state.turn ? { ...p, drawnTile: drawn } : p));
      return {
        ...state,
        wall: newWall,
        players,
        lastDiscard: null,
        callPassed: false,
        gameLog: [...state.gameLog, `${playerLabel(state.turn)} ツモ`],
        round: { ...state.round, turnCount: state.round.turnCount + 1 },
      };
    }

    case "DISCARD_TILE":
      return applyDiscard(state, action.tileIndex, action.fromDrawn, false);

    case "ARM_RIICHI":
      return canDeclareRiichi(state) ? { ...state, riichiArmed: true } : state;

    case "CANCEL_RIICHI":
      return { ...state, riichiArmed: false };

    case "DECLARE_RIICHI":
      return canRiichiWithDiscard(state, action.tileIndex, action.fromDrawn)
        ? applyDiscard(state, action.tileIndex, action.fromDrawn, true)
        : state;

    case "CALL_MELD": {
      const last = state.lastDiscard;
      if (!last || last.player === action.caller) return state;
      const caller = state.players[action.caller];
      if (caller.riichi) return state;
      const remainingHand = removeMany(caller.hand, action.tilesFromHand);
      if (!remainingHand) return state;

      const sourcePlayer = state.players[last.player];
      if (sourcePlayer.discards[sourcePlayer.discards.length - 1] !== last.tile) return state;

      const sourceUpdated: Player = {
        ...sourcePlayer,
        discards: sourcePlayer.discards.slice(0, -1),
        discardRecords: sourcePlayer.discardRecords.slice(0, -1),
      };
      const meldTiles = sortTiles([...action.tilesFromHand, last.tile]);
      let newWall = [...state.wall];
      let drawnTile: TileIndex | null = null;
      let turnCount = state.round.turnCount;
      const shouldDrawAfterKan = action.meldType === "kan" && newWall.length > 0;
      if (shouldDrawAfterKan) {
        drawnTile = newWall.shift()!;
        turnCount += 1;
      }

      const callerUpdated: Player = {
        ...caller,
        hand: sortTiles(remainingHand),
        drawnTile,
        melds: [...caller.melds, { type: action.meldType, tiles: meldTiles, fromPlayer: last.player }],
        tenpai: false,
      };
      const players = state.players.map((p) => {
        if (p.index === last.player) return sourceUpdated;
        if (p.index === action.caller) return callerUpdated;
        return p;
      });

      return {
        ...state,
        players,
        wall: newWall,
        turn: action.caller,
        lastDiscard: null,
        mustDiscard: action.meldType !== "kan",
        riichiArmed: false,
        callPassed: false,
        round: { ...state.round, turnCount },
        gameLog: [...state.gameLog, `${playerLabel(action.caller)} ${action.meldType.toUpperCase()}`],
      };
    }

    case "PASS_CALL":
      return { ...state, callPassed: true };

    case "PAUSE":
      return { ...state, isPaused: true };

    case "RESUME":
      return { ...state, isPaused: false };

    case "START_REVIEW":
      return { ...state, phase: "review", isPaused: false };

    default:
      return state;
  }
}

export function playerLabel(index: PlayerIndex): string {
  return ["あなた(東)", "CPU南", "CPU西", "CPU北"][index];
}

export function checkTsumoWin(state: GameState): boolean {
  const player = state.players[state.turn];
  if (player.drawnTile === null) return false;
  return isWinningHand([...player.hand, player.drawnTile]);
}

export function isWallEmpty(state: GameState): boolean {
  return state.wall.length === 0;
}
