#!/usr/bin/env node
/**
 * Vault の研究 Markdown を news-app 同梱 content/research へ同期する。
 *
 * 背景:
 *   - VPS のライブサーバーは vault.ts の VAULT_LIVE_ROOT (obsidian-vault/06_research)
 *     を直接読むため最新が即反映される。
 *   - 一方 Vercel など Vault 本体が存在しない環境では、リポジトリに同梱した
 *     content/research（fallback copy）しか読めない。
 *   - この同梱コピーの更新が 2026-05-27 で止まっており、Vercel 側だけ古い日付で
 *     停止して見える不具合があった。本スクリプトで定期的に同梱コピーを前進させる。
 *
 * 同期対象（vault.ts の CATEGORY_SUBDIR / 各 read* と一致させる）:
 *   - daily-market-research/ daily-ai-news/ daily-ai-tools/
 *     market-research-method-review/ daily-ai-papers/（存在すれば）
 *   - market-research-index.md / market-research-method.md / paper-watchlist.md
 *
 * 安全方針:
 *   - 破壊的削除はしない。新規・更新のみコピーする（mtime/サイズ差分）。
 *   - content/research/_template.md など同期対象外のファイルには触れない。
 *
 * 使い方:
 *   node scripts/sync-research-content.mjs            # 実コピー
 *   node scripts/sync-research-content.mjs --dry-run  # 差分のみ表示
 *   SOURCE_ROOT=/path/to/06_research node scripts/sync-research-content.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");

const SOURCE_ROOT =
  process.env.SOURCE_ROOT || "/root/company/obsidian-vault/06_research";
const DEST_ROOT = path.join(APP_ROOT, "content/research");
const DRY_RUN = process.argv.includes("--dry-run");

const SUBDIRS = [
  "daily-market-research",
  "daily-ai-news",
  "daily-ai-tools",
  "market-research-method-review",
  "daily-ai-papers",
];

const ROOT_FILES = [
  "market-research-index.md",
  "market-research-method.md",
  "paper-watchlist.md",
];

let copied = 0;
let skipped = 0;
const touchedDirs = new Set();

function needsCopy(src, dst) {
  if (!fs.existsSync(dst)) return true;
  const s = fs.statSync(src);
  const d = fs.statSync(dst);
  // Build-time sync must not clobber newer local policy/template edits.
  return s.mtimeMs > d.mtimeMs;
}

function copyFile(src, dst, label) {
  if (!needsCopy(src, dst)) {
    skipped++;
    return;
  }
  if (DRY_RUN) {
    console.log(`  [would copy] ${label}`);
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  copied++;
}

function syncDir(subdir) {
  const srcDir = path.join(SOURCE_ROOT, subdir);
  if (!fs.existsSync(srcDir)) return;
  const dstDir = path.join(DEST_ROOT, subdir);
  const files = fs
    .readdirSync(srcDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
  for (const f of files) {
    copyFile(path.join(srcDir, f), path.join(dstDir, f), `${subdir}/${f}`);
  }
  touchedDirs.add(subdir);
}

function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error(
      `[sync-research-content] SOURCE_ROOT not found: ${SOURCE_ROOT}\n` +
        `Vault 本体が無い環境ではスキップします（同梱コピーをそのまま使用）。`
    );
    process.exit(0);
  }
  console.log(`[sync-research-content]${DRY_RUN ? " (dry-run)" : ""}`);
  console.log(`  source: ${SOURCE_ROOT}`);
  console.log(`  dest  : ${DEST_ROOT}`);

  for (const sub of SUBDIRS) syncDir(sub);
  for (const f of ROOT_FILES) {
    const src = path.join(SOURCE_ROOT, f);
    if (fs.existsSync(src)) copyFile(src, path.join(DEST_ROOT, f), f);
  }

  console.log(`  copied: ${copied} / skipped(up-to-date): ${skipped}`);
  console.log(`  dirs  : ${[...touchedDirs].join(", ")}`);
}

main();
