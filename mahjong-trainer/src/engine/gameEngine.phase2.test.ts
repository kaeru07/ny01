import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canDeclareRiichi,
  createInitialState,
  gameReducer,
  getHumanCallOptions,
} from "@/engine/gameEngine";
import type { GameState } from "@/types/game";

function basePlayingState(): GameState {
  return {
    ...createInitialState(),
    phase: "playing",
    turn: 0,
    wall: [1, 2, 3, 4, 5, 6, 7, 8],
    dora: [8],
  };
}

test("打牌メタデータに手出し/ツモ切りを記録する", () => {
  const s = basePlayingState();
  s.players[0] = {
    ...s.players[0],
    hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    drawnTile: 13,
  };
  const handDiscard = gameReducer(s, { type: "DISCARD_TILE", tileIndex: 0, fromDrawn: false });
  assert.equal(handDiscard.players[0].discardRecords.at(-1)?.tsumogiri, false);

  const s2 = { ...s, players: s.players.map((p) => ({ ...p })) };
  const drawnDiscard = gameReducer(s2, { type: "DISCARD_TILE", tileIndex: 13, fromDrawn: true });
  assert.equal(drawnDiscard.players[0].discardRecords.at(-1)?.tsumogiri, true);
});

test("人間のポン候補を検出し、鳴いた牌を河から取り除く", () => {
  const s = basePlayingState();
  s.turn = 2;
  s.lastDiscard = { player: 1, tile: 5, tsumogiri: false, riichi: false };
  s.players[0] = { ...s.players[0], hand: [5, 5, 0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11], drawnTile: null };
  s.players[1] = { ...s.players[1], discards: [5], discardRecords: [{ tile: 5, tsumogiri: false, riichi: false }] };

  const options = getHumanCallOptions(s);
  assert.equal(options?.pon, true);
  const next = gameReducer(s, { type: "CALL_MELD", caller: 0, meldType: "pon", tilesFromHand: [5, 5] });
  assert.equal(next.turn, 0);
  assert.equal(next.mustDiscard, true);
  assert.equal(next.players[0].melds[0].type, "pon");
  assert.equal(next.players[1].discards.length, 0);
});

test("立直可能なテンパイ形で宣言すると1000点供託し横向き牌情報を残す", () => {
  const s = basePlayingState();
  s.players[0] = {
    ...s.players[0],
    hand: [0, 0, 0, 1, 2, 3, 9, 10, 11, 18, 19, 27, 27],
    drawnTile: 4,
    score: 25000,
  };
  assert.equal(canDeclareRiichi(s, 0), true);
  const next = gameReducer(s, { type: "DECLARE_RIICHI", tileIndex: 4, fromDrawn: true });
  assert.equal(next.players[0].riichi, true);
  assert.equal(next.players[0].score, 24000);
  assert.equal(next.players[0].discardRecords.at(-1)?.riichi, true);
});
