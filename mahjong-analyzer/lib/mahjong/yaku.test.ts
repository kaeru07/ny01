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

test("空欄は入力を促すエラーになる", () => {
  assert.deepEqual(parseHand("   "), {
    success: false,
    error: "手牌を入力してください",
  });
});

test("不正文字とスーツ未指定を具体的に案内する", () => {
  const invalidCharacter = parseHand("123m456p789s11z?");
  assert.equal(invalidCharacter.success, false);
  if (!invalidCharacter.success) {
    assert.match(invalidCharacter.error, /不正な文字/);
  }

  const missingSuit = parseHand("123m456p789s1111");
  assert.equal(missingSuit.success, false);
  if (!missingSuit.success) {
    assert.match(missingSuit.error, /スーツ文字/);
  }
});

test("少なすぎる枚数と5枚目の同一牌を拒否する", () => {
  const tooFew = parseHand("123m456p789s11z");
  assert.equal(tooFew.success, false);
  if (!tooFew.success) {
    assert.match(tooFew.error, /13枚か14枚/);
  }

  const fiveCopies = parseHand("11111m234p567s11z");
  assert.equal(fiveCopies.success, false);
  if (!fiveCopies.success) {
    assert.match(fiveCopies.error, /5枚以上/);
  }
});

test("字牌の0は赤ドラとして受理しない", () => {
  const redHonor = parseHand("123m456p789s110z");
  assert.equal(redHonor.success, false);
  if (!redHonor.success) {
    assert.match(redHonor.error, /数牌 \(m\/p\/s\) のみ/);
  }
});
