import { test } from "node:test";
import assert from "node:assert/strict";
import { gameReducer, createInitialState } from "@/engine/gameEngine";
import type { GameState } from "@/types/game";

function startedGame(): GameState {
  return gameReducer(createInitialState(), { type: "START_GAME" });
}

// 自分(東家)の手牌枚数。ツモ牌は hand に含めず drawnTile で持つ設計。
function handCount(s: GameState, seat = 0) {
  const p = s.players[seat];
  return p.hand.length + (p.drawnTile !== null ? 1 : 0);
}

test("配牌直後は自分が13枚+ツモ1枚=14枚相当", () => {
  const s = startedGame();
  assert.equal(s.players[0].hand.length, 13);
  assert.notEqual(s.players[0].drawnTile, null);
  assert.equal(handCount(s), 14);
});

test("ツモ牌を打牌すると手牌は13枚に戻る（ツモ切り）", () => {
  const s = startedGame();
  const drawn = s.players[0].drawnTile!;
  const next = gameReducer(s, { type: "DISCARD_TILE", tileIndex: drawn });
  assert.equal(next.players[0].hand.length, 13);
  assert.equal(next.players[0].drawnTile, null);
  assert.equal(next.players[0].discards.length, 1);
});

test("手牌の牌を打牌してもツモ牌が消えず13枚を保つ（手出し・牌が減るバグの回帰）", () => {
  const s = startedGame();
  const drawn = s.players[0].drawnTile!;
  const handTile = s.players[0].hand[0]; // ツモ牌ではない手牌の1枚を切る
  const next = gameReducer(s, { type: "DISCARD_TILE", tileIndex: handTile });

  // 手出し後も必ず13枚。以前はツモ牌を戻し忘れて12枚になっていた。
  assert.equal(next.players[0].hand.length, 13, "手出し後の手牌は13枚であるべき");
  assert.equal(next.players[0].drawnTile, null);
  // 切った牌が河に、ツモ牌は手牌に残っている
  assert.equal(next.players[0].discards[0], handTile);
  assert.ok(next.players[0].hand.includes(drawn), "ツモ牌が手牌に残っているべき");
});

test("複数巡（ツモ→打牌）を繰り返しても手牌枚数が減らない", () => {
  let s = startedGame();
  for (let i = 0; i < 8; i++) {
    // 自分の番になるまで進める必要はなく、reducer を直接叩いて自分の巡だけ検証する
    if (s.turn !== 0) {
      // 他家の番はスキップ用に turn を 0 に戻した検証用状態を作る
      s = { ...s, turn: 0 };
    }
    if (s.players[0].drawnTile === null) {
      s = gameReducer(s, { type: "DRAW_TILE" });
    }
    // 手牌の先頭（手出し）を切る
    const handTile = s.players[0].hand[0];
    s = gameReducer(s, { type: "DISCARD_TILE", tileIndex: handTile });
    assert.equal(s.players[0].hand.length, 13, `巡${i}: 手牌は13枚を保つ`);
  }
});
