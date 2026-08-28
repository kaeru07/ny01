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
const SEED = Number(process.env.SEED || 20260810);

const VIEWPORTS = [
  { name: "portrait-390", width: 390, height: 844 },
  { name: "portrait-375", width: 375, height: 667 },
  { name: "landscape-844", width: 844, height: 390 },
].filter((viewport) => !process.env.VIEWPORT || viewport.name === process.env.VIEWPORT);

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

async function riverState(page) {
  return page.locator("[data-river-rotation]").evaluateAll((rivers) =>
    Object.fromEntries(
      rivers.map((river) => [
        river.getAttribute("data-river-rotation"),
        {
          discards: Number(river.getAttribute("data-discard-count")),
          chunks: river.querySelectorAll("[data-river-chunk]").length,
        },
      ])
    )
  );
}

async function reachWrappedRivers(page, label) {
  const requiredRotations = ["0", "90", "180", "270"];

  for (let round = 0; round < 9; round++) {
    const rivers = await riverState(page);
    if (requiredRotations.every((rotation) => rivers[rotation]?.discards >= 7)) {
      const wrapped = requiredRotations.every((rotation) => rivers[rotation]?.chunks >= 2);
      console.log(`[${label}] ${wrapped ? "OK" : "NG"} river-wrap ${JSON.stringify(rivers)}`);
      return wrapped;
    }

    const tile = page.locator(".hand-area .hand-row .tile-hand.cursor-pointer").first();
    try {
      await tile.click({ timeout: 5000 });
      await page.waitForFunction(
        (previous) => {
          const self = document.querySelector('[data-river-rotation="0"]');
          return Number(self?.getAttribute("data-discard-count") ?? 0) > previous;
        },
        rivers["0"]?.discards ?? 0,
        { timeout: 7000 }
      );
    } catch {
      console.log(
        `[${label}] NG 対局が終了し、4方向7枚以上の河を生成できませんでした ${JSON.stringify(await riverState(page))}`
      );
      return false;
    }
  }

  console.log(`[${label}] NG 9巡以内に4方向7枚以上の河を生成できませんでした`);
  return false;
}

const browser = await chromium.launch();
async function verifyViewport(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript((seed) => {
    // 視覚回帰用に配牌とCPU選択を固定し、長い河を毎回同じ状態で再現する。
    let state = seed >>> 0;
    Math.random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }, SEED);
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));

  const response = await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-start.png` });

  let viewportOk = response?.ok() ?? false;
  const start = page.getByRole("button", { name: "対局開始" });
  if (await start.count()) {
    await start.first().click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-game.png` });
    viewportOk = (await measure(page, `${vp.name}/game`)) && viewportOk;

    const riversWrapped = await reachWrappedRivers(page, `${vp.name}/wrapped`);
    await page.screenshot({ path: `${OUT}/${TAG}-${vp.name}-mid.png` });
    viewportOk = riversWrapped && (await measure(page, `${vp.name}/mid`)) && viewportOk;
  } else {
    errors.push("対局開始ボタンが見つからず、対局画面を検証できませんでした");
  }

  if (errors.length) console.log(`[${vp.name}] console errors:`, errors.slice(0, 5));

  await ctx.close();
  return viewportOk && errors.length === 0;
}

const results = [];
for (const viewport of VIEWPORTS) {
  results.push(await verifyViewport(viewport));
}
const allOk = results.every(Boolean);
await browser.close();
console.log(`screenshots -> ${OUT}/`);
console.log(
  allOk
    ? "はみ出し判定: OK（ただし合否は画像の目視で決めること）"
    : "はみ出し判定: NG（牌が画面外にはみ出している）"
);
if (!allOk) process.exitCode = 1;
