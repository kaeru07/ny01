import assert from "node:assert/strict";
import test from "node:test";
import { tileAccessibleName, tileDisplayKey, tileToIndex } from "./tiles";

test("赤5と通常5は解析上は同種でも表示選択キーでは区別する", () => {
  const normalFive = { suit: "m", number: 5 } as const;
  const redFive = { suit: "m", number: 5, isRed: true } as const;

  assert.equal(tileToIndex(normalFive), tileToIndex(redFive));
  assert.notEqual(tileDisplayKey(normalFive), tileDisplayKey(redFive));
});

test("同じ表示属性の牌は同じ表示選択キーになる", () => {
  assert.equal(
    tileDisplayKey({ suit: "p", number: 5, isRed: true }),
    tileDisplayKey({ suit: "p", number: 5, isRed: true })
  );
});

test("牌をスクリーンリーダー向けの日本語名に変換する", () => {
  assert.equal(tileAccessibleName({ suit: "m", number: 1 }), "一萬");
  assert.equal(
    tileAccessibleName({ suit: "p", number: 5, isRed: true }),
    "赤五筒"
  );
  assert.equal(tileAccessibleName({ suit: "z", number: 7 }), "中");
});
