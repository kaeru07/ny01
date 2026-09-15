import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const tilesDir = join(process.cwd(), "public", "tiles");

function readTile(...parts: string[]): string {
  return readFileSync(join(tilesDir, ...parts), "utf8");
}

const numberedTiles = ["man", "pin", "sou"].flatMap((suit) => [
  ...Array.from({ length: 9 }, (_, index) => [suit, `${index + 1}.svg`]),
  [suit, "5-red.svg"],
]);

const honorTiles = [
  "east.svg",
  "south.svg",
  "west.svg",
  "north.svg",
  "white.svg",
  "green.svg",
  "red.svg",
].map((name) => ["honor", name]);

test("全牌画像を同じ3:4のSVGセットで表示する", () => {
  const paths = [...numberedTiles, ...honorTiles, ["back.svg"]];

  for (const parts of paths) {
    const svg = readTile(...parts);
    assert.match(svg, /<svg\b/);
    assert.match(svg, /viewBox="0 0 300 400"/);
    assert.doesNotMatch(svg, /<(?:text|tspan|image)\b/);
  }
});

test("牌素材のCC0ライセンスを同梱する", () => {
  const license = readTile("FLUFFYSTUFF_LICENSE.md");
  assert.match(license, /public domain/i);
  assert.match(license, /creativecommons\.org\/publicdomain\/zero\/1\.0/);
});
