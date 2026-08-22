import assert from "node:assert/strict";
import test from "node:test";
import { parseHand } from "./parser";

test("13枚と14枚の有効な手牌を受け付ける", () => {
  const thirteenTiles = parseHand("123m456p789s11z12m");
  const fourteenTiles = parseHand("123m456p789s11z12m5p");

  assert.equal(thirteenTiles.success, true);
  assert.equal(fourteenTiles.success, true);
  if (thirteenTiles.success) assert.equal(thirteenTiles.tiles.length, 13);
  if (fourteenTiles.success) assert.equal(fourteenTiles.tiles.length, 14);
});

test("数牌の0を赤5として扱う", () => {
  const result = parseHand("023m456p789s11z12m");

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.tiles[0], { suit: "m", number: 5, isRed: true });
});

test("日本語キーボードの全角数字・英字を受け付ける", () => {
  const result = parseHand("１２３ｍ４５６ｐ７８９ｓ１１ｚ１２ｍ");

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.tiles.length, 13);
});

test("大文字のスーツ記号を受け付ける", () => {
  const result = parseHand("123M456P789S11Z12M");

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.tiles.length, 13);
});

test("字牌の0は赤ドラとして受け付けない", () => {
  const result = parseHand("123m456p789s10z12m");

  assert.deepEqual(result, {
    success: false,
    error: '赤ドラの "0" は数牌 (m/p/s) のみに使用できます',
  });
});

test("赤5を含めて同じ牌が5枚になる入力を拒否する", () => {
  const result = parseHand("05555m123p123s11z");

  assert.deepEqual(result, {
    success: false,
    error: "同じ牌が5枚以上あります (5m)",
  });
});

test("同じ種類の赤5が複数ある入力を拒否する", () => {
  const result = parseHand("005m123p456s123z11m");

  assert.deepEqual(result, {
    success: false,
    error: "同じ種類の赤5は1枚までです (0m)",
  });
});

test("13枚か14枚ではない入力を理由付きで拒否する", () => {
  const tooFew = parseHand("123m456p789s11z");
  const tooMany = parseHand("123m456p789s111z123m");

  assert.equal(tooFew.success, false);
  assert.equal(tooMany.success, false);
  if (!tooFew.success) assert.match(tooFew.error, /枚数が少なすぎます/);
  if (!tooMany.success) assert.match(tooMany.error, /枚数が多すぎます/);
});

test("枚数が揃っていても形式が不正な入力は解析可能と判定しない", () => {
  const missingSuit = parseHand("1234567890123");
  const fiveIdenticalTiles = parseHand("11111m234p567s12z");

  assert.equal(missingSuit.success, false);
  assert.equal(fiveIdenticalTiles.success, false);
});

test("極端に長い数字列は牌種の確定を待たず安全に拒否する", () => {
  const result = parseHand("1".repeat(100_000));

  assert.deepEqual(result, {
    success: false,
    error: "枚数が多すぎます (15枚以上)。13枚か14枚を入力してください",
  });
});

test("ネイティブ境界から文字列以外が渡ってもクラッシュせず拒否する", () => {
  for (const invalidInput of [null, undefined, 123, {}, []]) {
    const result = parseHand(invalidInput as unknown as string);

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error, /文字列/);
    }
  }
});
