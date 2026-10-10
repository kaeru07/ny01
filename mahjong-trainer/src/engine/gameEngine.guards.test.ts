import { test } from "node:test";
import assert from "node:assert/strict";
import { createInitialState, gameReducer } from "@/engine/gameEngine";

test("王牌14枚を通常山から除外し、初期の通常山は69枚", () => {
  const state = gameReducer(createInitialState(), { type: "START_GAME" });
  assert.equal(state.wall.length, 69);
  assert.equal(state.players[0].hand.length, 13);
  assert.notEqual(state.players[0].drawnTile, null);
  assert.equal(state.dora.length, 1);
});

test("二重ツモは山も状態も変えない", () => {
  const state = gameReducer(createInitialState(), { type: "START_GAME" });
  assert.equal(gameReducer(state, { type: "DRAW_TILE" }), state);
});

test("手元に存在しない牌は打牌できない", () => {
  const state = gameReducer(createInitialState(), { type: "START_GAME" });
  const tiles = [...state.players[0].hand, state.players[0].drawnTile!];
  const absent = Array.from({ length: 34 }, (_, index) => index).find(index => !tiles.includes(index));
  assert.notEqual(absent, undefined);
  assert.equal(gameReducer(state, { type: "DISCARD_TILE", tileIndex: absent! }), state);
});

test("一時停止中の打牌を拒否する", () => {
  const playing = gameReducer(createInitialState(), { type: "START_GAME" });
  const paused = gameReducer(playing, { type: "PAUSE" });
  assert.equal(gameReducer(paused, { type: "DISCARD_TILE", tileIndex: paused.players[0].drawnTile! }), paused);
});
