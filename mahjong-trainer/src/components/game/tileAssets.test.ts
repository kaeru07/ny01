import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const tilesDir = join(process.cwd(), "public", "tiles");

function readTile(...parts: string[]): string {
  return readFileSync(join(tilesDir, ...parts), "utf8");
}

test("萬子は端末フォントに依存しないアウトラインで描画される", () => {
  for (let number = 1; number <= 9; number += 1) {
    const svg = readTile("man", `${number}.svg`);
    assert.doesNotMatch(svg, /<(?:text|tspan)\b/);
    assert.equal((svg.match(/<path\b/g) ?? []).length, 2);
  }
});

test("筒子は各筒を同心円で描画する", () => {
  for (let number = 1; number <= 9; number += 1) {
    const svg = readTile("pin", `${number}.svg`);
    const circles = (svg.match(/<circle\b/g) ?? []).length;
    const expected = number === 1 ? 5 : number * 3;
    assert.equal(circles, expected, `${number}筒の円数`);
  }
});

test("索子は一索を鳥、二索以降を節付きの竹として描画する", () => {
  assert.match(readTile("sou", "1.svg"), /<ellipse\b/);

  for (let number = 2; number <= 9; number += 1) {
    const svg = readTile("sou", `${number}.svg`);
    const bambooParts = (svg.match(/<rect\b/g) ?? []).length - 4;
    assert.equal(bambooParts, number * 4, `${number}索の竹パーツ数`);
  }
});
