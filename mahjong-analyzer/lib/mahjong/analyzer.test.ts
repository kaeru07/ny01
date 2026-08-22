import assert from "node:assert/strict";
import test from "node:test";
import { analyzeHand, countRemainingTile } from "./analyzer";
import { parseHand } from "./parser";

function parseValidHand(input: string) {
  const parsed = parseHand(input);
  if (!parsed.success) assert.fail(parsed.error);
  return parsed.tiles;
}

test("13枚の手牌は有効牌を返す", () => {
  const result = analyzeHand(parseValidHand("123m456p789s11z12m"));

  assert.equal(result.tileCount, 13);
  assert.equal(result.discardCandidates.length, 0);
  assert.ok(result.effectiveTiles.length > 0);
  assert.ok(result.effectiveTileCount > 0);
});

test("有効牌ごとの残り枚数は手牌内の同種牌を除いて数える", () => {
  const hand = parseValidHand("123m456p789s11z12m");

  assert.equal(countRemainingTile({ suit: "m", number: 1 }, hand), 2);
  assert.equal(countRemainingTile({ suit: "p", number: 9 }, hand), 4);
});

test("13枚解析の受け入れ合計は有効牌ごとの残り枚数の合計と一致する", () => {
  const hand = parseValidHand("123m456p789s11z12m");
  const result = analyzeHand(hand);
  const displayedRemainingTotal = result.effectiveTiles.reduce(
    (total, tile) => total + countRemainingTile(tile, result.hand),
    0
  );

  assert.equal(result.effectiveTileCount, displayedRemainingTotal);
});

test("13枚解析では4枚持ちの牌を残り0枚の有効牌として表示しない", () => {
  const result = analyzeHand(parseValidHand("1111m23m456p789s1z"));

  assert.ok(
    result.effectiveTiles.every(
      ({ suit, number }) => suit !== "m" || number !== 1
    ),
    "手牌ですべて見えている1萬は有効牌一覧に含めない"
  );
  assert.ok(
    result.effectiveTiles.every(
      (tile) => countRemainingTile(tile, result.hand) > 0
    ),
    "有効牌一覧に残り0枚の牌を含めない"
  );
});

test("14枚の手牌は打牌候補を返す", () => {
  const result = analyzeHand(parseValidHand("123m456p789s11z12m5p"));

  assert.equal(result.tileCount, 14);
  assert.ok(result.discardCandidates.length > 0);
  assert.ok(
    result.discardCandidates.every((candidate) => candidate.reason.length > 0),
    "画面に表示する全打牌候補に解説が必要"
  );
});

test("同じ手牌は入力順が違っても打牌候補の順位が変わらない", () => {
  const ordered = analyzeHand(parseValidHand("123m456p789s11z12m5p"));
  const reordered = analyzeHand(parseValidHand("321m654p987s11z21m5p"));
  const candidateKeys = (result: ReturnType<typeof analyzeHand>) =>
    result.discardCandidates.map(
      ({ tile, resultShanten, effectiveTileCount }) =>
        `${tile.number}${tile.suit}:${resultShanten}:${effectiveTileCount}`
    );

  assert.deepEqual(candidateKeys(reordered), candidateKeys(ordered));
});

test("14枚解析は呼び出し元の手牌データを変更しない", () => {
  const hand = parseValidHand("123m456p789s11z12m5p");
  const snapshot = structuredClone(hand);

  const result = analyzeHand(hand);

  assert.deepEqual(hand, snapshot, "候補試算で入力配列や牌を変更しない");
  assert.deepEqual(result.hand, snapshot, "解析結果にも元の手牌を保持する");
});

test("シャンテン数が悪化する候補を受け入れが広いとは案内しない", () => {
  const result = analyzeHand(parseValidHand("52226m57647p216s3z"));
  const bestShanten = result.discardCandidates[0]?.resultShanten;
  const worseCandidates = result.discardCandidates.filter(
    (candidate) => candidate.resultShanten !== bestShanten
  );

  assert.ok(worseCandidates.length > 0, "シャンテン数が異なる候補を含む手牌であること");
  assert.ok(
    worseCandidates.every(
      (candidate) => !candidate.labels.includes("受け入れ広い")
    ),
    "シャンテン数の維持より見かけの受け入れ枚数を優先してはいけない"
  );
});

test("場況情報なしで字牌を安全牌とは案内しない", () => {
  const result = analyzeHand(parseValidHand("52226m57647p216s3z"));
  const honorCandidates = result.discardCandidates.filter(
    ({ tile }) => tile.suit === "z"
  );

  assert.ok(honorCandidates.length > 0, "字牌の打牌候補を含む手牌であること");
  assert.ok(
    honorCandidates.every(
      ({ labels, reason }) =>
        !labels.includes("安全牌候補") && !reason.includes("安全")
    ),
    "相手の河や場況がない解析で安全性を断定してはいけない"
  );
  const topHonorCandidates = result.discardCandidates
    .slice(0, 3)
    .filter(({ tile }) => tile.suit === "z");
  assert.ok(topHonorCandidates.length > 0, "上位3件に字牌候補を含む手牌であること");
  assert.ok(
    topHonorCandidates.every(({ labels }) => labels.includes("字牌")),
    "上位候補では安全性ではなく牌種を案内する"
  );
});

test("14枚ですでに和了形なら打牌候補を返さない", () => {
  const result = analyzeHand(parseValidHand("123456789m11122z"));

  assert.equal(result.tileCount, 14);
  assert.equal(result.shanten, -1);
  assert.equal(result.effectiveTileCount, 0);
  assert.deepEqual(result.effectiveTiles, []);
  assert.deepEqual(result.discardCandidates, []);
});

test("14枚解析では河に捨てた牌を受け入れ枚数に含めない", () => {
  const result = analyzeHand(parseValidHand("123m456p789s11z12m5p"));
  const discard1m = result.discardCandidates.find(
    ({ tile }) => tile.suit === "m" && tile.number === 1
  );

  assert.ok(discard1m);
  assert.ok(
    discard1m.effectiveTiles.some(
      ({ suit, number }) => suit === "m" && number === 1
    ),
    "捨てた1mが有効牌になるケースであること"
  );
  assert.equal(discard1m.effectiveTileCount, 29);
});

test("全打牌候補の受け入れ合計は有効牌ごとの表示枚数と一致する", () => {
  const result = analyzeHand(parseValidHand("123m456p789s11z12m5p"));

  for (const candidate of result.discardCandidates) {
    const displayedRemainingTotal = candidate.effectiveTiles.reduce(
      (total, tile) => total + countRemainingTile(tile, result.hand),
      0
    );

    assert.equal(
      candidate.effectiveTileCount,
      displayedRemainingTotal,
      `${candidate.tile.number}${candidate.tile.suit}切りの表示合計`
    );
  }
});

test("4枚持ちから捨てた牌を残り0枚の有効牌として表示しない", () => {
  const result = analyzeHand(parseValidHand("15m19p23466668s46z"));
  const discard6s = result.discardCandidates.find(
    ({ tile }) => tile.suit === "s" && tile.number === 6
  );

  assert.ok(discard6s);
  assert.ok(
    discard6s.effectiveTiles.every(
      ({ suit, number }) => suit !== "s" || number !== 6
    ),
    "手牌3枚と河1枚で全て見えている6索は有効牌一覧に含めない"
  );
});

test("赤5と通常5を両方持つ場合は通常5を打牌候補にする", () => {
  const result = analyzeHand(parseValidHand("05523m1237p456s11z"));
  const discard5m = result.discardCandidates.find(
    ({ tile }) => tile.suit === "m" && tile.number === 5
  );

  assert.ok(discard5m);
  assert.equal(discard5m.tile.isRed, false);
  assert.equal(
    result.discardCandidates.filter(
      ({ tile }) => tile.suit === "m" && tile.number === 5
    ).length,
    1,
    "赤5と通常5は同じ牌種として候補を重複させない"
  );
});

test("13枚か14枚でない手牌は解析を拒否する", () => {
  assert.throws(
    () => analyzeHand([]),
    /13枚か14枚の手牌が必要です \(現在0枚\)/
  );
});

test("共有ロジックへ壊れた手牌データが渡っても明示的な入力エラーにする", () => {
  assert.throws(
    () => analyzeHand(null as unknown as Parameters<typeof analyzeHand>[0]),
    /手牌データは配列で指定してください/
  );

  const hand = parseValidHand("123m456p789s11z12m");
  const corruptedHand = [
    null,
    ...hand.slice(1),
  ] as unknown as Parameters<typeof analyzeHand>[0];

  assert.throws(
    () => analyzeHand(corruptedHand),
    /存在しない牌が含まれています \(1枚目\)/
  );
});

test("同じ牌を5枚含む手牌は解析層でも拒否する", () => {
  assert.throws(
    () =>
      analyzeHand([
        { suit: "m", number: 1 },
        { suit: "m", number: 1 },
        { suit: "m", number: 1 },
        { suit: "m", number: 1 },
        { suit: "m", number: 1 },
        { suit: "m", number: 2 },
        { suit: "m", number: 3 },
        { suit: "p", number: 4 },
        { suit: "p", number: 5 },
        { suit: "p", number: 6 },
        { suit: "s", number: 7 },
        { suit: "s", number: 8 },
        { suit: "s", number: 9 },
      ]),
    /同じ牌は4枚までです \(1m\)/
  );
});

test("存在しない牌は解析層でも拒否する", () => {
  const hand = parseValidHand("123m456p789s11z12m");

  assert.throws(
    () => analyzeHand([{ ...hand[0], number: 10 }, ...hand.slice(1)]),
    /存在しない牌が含まれています \(10m\)/
  );
  assert.throws(
    () => analyzeHand([{ ...hand[0], suit: "z", number: 8 }, ...hand.slice(1)]),
    /存在しない牌が含まれています \(8z\)/
  );
});

test("赤ドラフラグが真偽値でない壊れた牌データを拒否する", () => {
  const hand = parseValidHand("123m456p789s11z12m");
  const corruptedHand = [
    { ...hand[0], isRed: "false" },
    ...hand.slice(1),
  ] as unknown as Parameters<typeof analyzeHand>[0];

  assert.throws(
    () => analyzeHand(corruptedHand),
    /存在しない牌が含まれています \(1m\)/
  );
});

test("数牌の5以外への赤ドラ指定は解析層でも拒否する", () => {
  const hand = parseValidHand("123m456p789s11z12m");

  assert.throws(
    () => analyzeHand([{ ...hand[0], isRed: true }, ...hand.slice(1)]),
    /赤ドラに指定できるのは数牌の5だけです \(1m\)/
  );
  assert.throws(
    () =>
      analyzeHand([
        ...hand.slice(0, 9),
        { ...hand[9], isRed: true },
        ...hand.slice(10),
      ]),
    /赤ドラに指定できるのは数牌の5だけです \(1z\)/
  );
});

test("同じ種類の赤5が複数ある手牌は解析層でも拒否する", () => {
  const hand = parseValidHand("155m123p456s123z1m");

  assert.throws(
    () =>
      analyzeHand([
        hand[0],
        { ...hand[1], isRed: true },
        { ...hand[2], isRed: true },
        ...hand.slice(3),
      ]),
    /同じ種類の赤5は1枚までです \(0m\)/
  );
});
