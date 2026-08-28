#!/usr/bin/env node
/**
 * 最新の日次調査が「1日1ページの記事」形式を満たすか、読み取り専用で検証する。
 * 引数に Markdown パスを渡した場合は、そのファイルだけを検証する。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESEARCH_ROOT = path.join(APP_ROOT, "content/research");
const DAILY_DIRS = [
  "daily-market-research",
  "daily-ai-news",
  "daily-ai-tools",
  "market-research-method-review",
  "daily-ai-papers",
];
const DATE_FILE_RE = /^\d{4}-\d{2}-\d{2}\.md$/;
const ARTICLE_HEADING_RE = /^(?:記事本文|詳細記事|本文|Article Body)$/i;

function latestFiles() {
  return DAILY_DIRS.flatMap((directory) => {
    const fullDirectory = path.join(RESEARCH_ROOT, directory);
    if (!fs.existsSync(fullDirectory)) return [];
    const latest = fs
      .readdirSync(fullDirectory)
      .filter((file) => DATE_FILE_RE.test(file))
      .sort()
      .at(-1);
    return latest ? [path.join(fullDirectory, latest)] : [];
  });
}

function sectionBody(markdown, headingPattern) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => {
    const match = line.match(/^##\s+(.+?)\s*$/);
    return match && headingPattern.test(match[1]);
  });
  if (start < 0) return null;
  const endOffset = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n").trim();
}

function articleParagraphs(body) {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.replace(/^###\s+.*$/gm, "").trim())
    .filter((block) => block.length > 0 && !/^[-*]\s+/m.test(block));
}

function validate(file) {
  const markdown = fs.readFileSync(file, "utf8");
  const errors = [];
  if (/^#\s+\(fallback\)/m.test(markdown) || /^##\s+実行エラー/m.test(markdown)) {
    errors.push("fallback または実行エラーの生成物です");
  }

  const conclusion = sectionBody(markdown, /^(?:今日の結論|結論)$/);
  if (!conclusion) errors.push("「今日の結論」がありません、または空です");

  const article = sectionBody(markdown, ARTICLE_HEADING_RE);
  if (!article) {
    errors.push("「記事本文」がありません、または空です");
  } else {
    const characterCount = article.replace(/\s/g, "").length;
    const paragraphCount = articleParagraphs(article).length;
    if (characterCount < 800) errors.push(`記事本文が短すぎます（${characterCount}字 / 最低800字）`);
    if (paragraphCount < 4) errors.push(`記事本文の段落が不足しています（${paragraphCount}段落 / 最低4段落）`);
  }
  return errors;
}

const requested = process.argv.slice(2).map((file) => path.resolve(file));
const files = requested.length > 0 ? requested : latestFiles();
const missing = files.filter((file) => !fs.existsSync(file));
if (files.length === 0 || missing.length > 0) {
  for (const file of missing) console.error(`[error] ファイルがありません: ${file}`);
  if (files.length === 0) console.error("[error] 検証対象の日次Markdownがありません");
  process.exitCode = 1;
} else {
  let passed = 0;
  let failed = 0;
  for (const file of files) {
    const errors = validate(file);
    const label = path.relative(APP_ROOT, file);
    if (errors.length === 0) {
      passed += 1;
      console.log(`[ok] ${label}`);
    } else {
      failed += 1;
      for (const error of errors) console.error(`[error] ${label}: ${error}`);
    }
  }
  console.log(`[summary] checked=${files.length} passed=${passed} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}
