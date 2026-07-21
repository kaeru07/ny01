/**
 * 実描画スクリーンショット取得（UI 検証用）
 *
 *   npm run dev -- -p 3457 &
 *   node scripts/screenshot.mjs
 *
 * 撮った画像は必ず目視で確認すること。build が通ったことは UI の合否判定にならない。
 * 出力先は OUT_DIR（既定 .screenshots/）。
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// playwright-core は scrape-lab(note) の node_modules を借りる。chromium 本体は
// /root/.cache/ms-playwright に導入済み。
const { chromium } = require("/root/company/apps/note/node_modules/playwright-core");

const OUT = process.env.OUT_DIR || ".screenshots";
const URL = process.env.URL || "http://localhost:3457/";
const TAG = process.env.TAG || "ui";

const VIEWPORTS = [
  { name: "portrait-390", width: 390, height: 844 },
  { name: "portrait-375", width: 375, height: 667 },
  { name: "landscape-844", width: 844, height: 390 },
];

mkdirSync(OUT, { recursive: true });

/**
 * 牌が画面外へはみ出していないかを、撮影したのと同じ瞬間に測る。
 * 要素の scrollWidth 比較だけでは、親側でクリップされている場合に
 * 「はみ出していない」と誤判定するので、実座標で見る。
 */
async function measure(page, label) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const boxes = (sel) =>
      [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect());
    const summarize = (rects) => {
      if (!rects.length) return null;
      const left = Math.min(...rects.map((b) => b.left));
      const right = Math.max(...rects.map((b) => b.right));
      return {
        count: rects.length,
        left: Math.round(left),
        right: Math.round(right),
        clippedLeft: left < -0.5,
        clippedRight: right > vw + 0.5,
      };
    };
    return {
      viewportWidth: vw,
      hand: summarize(boxes(".hand-row .tile-hand, [data-hand-tile]")),
      allTiles: summarize(boxes(".tile-hand, .tile-sm, .tile-md")),
      docOverflowing: document.documentElement.scrollWidth > vw + 1,
    };
  });
  const bad =
    r.docOverflowing ||
    (r.hand && (r.hand.clippedLeft || r.hand.clippedRight)) ||
    (r.allTiles && (r.allTiles.clippedLeft || r.allTiles.clippedRight));
  console.log(`[${label}] ${bad ? "NG" : "OK"} ${JSON.stringify(r)}`);
  return !bad;
}

const browser = await chromium.launch();
let allOk = true;

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-start.png` });

  const start = page.getByRole("button", { name: "対局開始" });
  if (await start.count()) {
    await start.first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-game.png` });
    allOk = (await measure(page, `${vp.name}/game`)) && allOk;

    // 河に牌が並んだ状態を作るため数巡進める
    for (let i = 0; i < 6; i++) {
      const tiles = page.locator(".hand-row .tile-hand, [data-hand-tile]");
      if (await tiles.count()) {
        try {
          await tiles.nth(0).click({ timeout: 1500 });
        } catch {
          /* 自分の手番でなければ無視 */
        }
      }
      await page.waitForTimeout(1800);
    }
    await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-mid.png` });
    allOk = (await measure(page, `${vp.name}/mid`)) && allOk;
  }

  if (errors.length) console.log(`[${vp.name}] console errors:`, errors.slice(0, 5));

  await ctx.close();
}

await browser.close();
console.log(`screenshots -> ${OUT}/`);
console.log(
  allOk
    ? "はみ出し判定: OK（ただし合否は画像の目視で決めること）"
    : "はみ出し判定: NG（牌が画面外にはみ出している）"
);
if (!allOk) process.exitCode = 1;
