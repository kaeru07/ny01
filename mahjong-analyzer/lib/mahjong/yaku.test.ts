import assert from "node:assert/strict";
import test from "node:test";
import { parseHand } from "./parser";
import { tilesToCounts } from "./tiles";
import { possibleYaku } from "./yaku";

function yakuFor(hand: string): string[] {
  const parsed = parseHand(hand);
  assert.equal(parsed.success, true);
  if (!parsed.success) return [];
  return possibleYaku(tilesToCounts(parsed.tiles));
}

test("么九牌がない手はタンヤオ候補", () => {
  assert.ok(yakuFor("234567m345p6678s").includes("タンヤオ"));
});

test("一種類の数牌だけで字牌がなければ清一色候補", () => {
  assert.ok(yakuFor("1122334567789m").includes("清一色"));
});

test("4対子以上かつ刻子なしなら七対子候補", () => {
  assert.ok(yakuFor("1122m3344p5566s1z").includes("七対子"));
});

test("白・發・中の対子があれば役牌候補", () => {
  assert.ok(yakuFor("123m456p789s55z12m").includes("役牌(白發中)"));
});
