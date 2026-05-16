#!/usr/bin/env python3
"""
review_execution_runs.py — Codex SDK 最小実験（読み取り専用）

progress の execution-runs.json を読み取り、レビューが必要な Run を抽出し、
codex exec (read-only sandbox) に渡してレビュー要約と改善 ToDo 候補を出す。

【安全方針】
- execution-runs.json / project-tasks.json / .env は読み取りのみ。一切書き換えない
- codex は `--sandbox read-only` で起動（モデルがコマンド実行してもファイル変更不可）
- progress 本体コードには触れない
- 既定では codex を呼ぶ前に対象を表示。--dry-run で codex 呼び出しを完全にスキップ

使い方:
  python3 review_execution_runs.py --dry-run            # 抽出のみ（codex 呼ばない）
  python3 review_execution_runs.py --limit 5            # 最大5件を codex に渡す
  python3 review_execution_runs.py --runs-file <path>   # 対象 json を明示

終了コード: 0=正常 / 2=入力エラー / 3=codex 実行エラー
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

DEFAULT_DATA_DIR = os.environ.get(
    "PROGRESS_DATA_PATH", "/root/company/apps/ny01/progress/data/real"
)
DEFAULT_RUNS_FILE = str(Path(DEFAULT_DATA_DIR) / "execution-runs.json")

# レビュー対象とみなす条件
REVIEW_STATUSES = {"not_reviewed", "needs_followup"}
RUN_STATUSES = {"failed", "partial"}

CODEX_TIMEOUT_SEC = 180
MAX_RAWREPORT_CHARS = 1200


def load_runs(path: str) -> list[dict]:
    p = Path(path)
    if not p.is_file():
        print(f"[ERROR] runs ファイルが見つかりません: {path}", file=sys.stderr)
        sys.exit(2)
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON 解析失敗: {e}", file=sys.stderr)
        sys.exit(2)
    runs = data.get("runs")
    if not isinstance(runs, list):
        print("[ERROR] runs 配列がありません", file=sys.stderr)
        sys.exit(2)
    return runs


def needs_review(run: dict) -> bool:
    if run.get("reviewStatus") in REVIEW_STATUSES:
        return True
    if run.get("runStatus") in RUN_STATUSES:
        return True
    return False


def compact_run(run: dict) -> dict:
    raw = run.get("rawReport") or ""
    if len(raw) > MAX_RAWREPORT_CHARS:
        raw = raw[:MAX_RAWREPORT_CHARS] + " …(truncated)"
    return {
        "runId": run.get("runId"),
        "targetApp": run.get("targetApp"),
        "targetTodoTitle": run.get("targetTodoTitle"),
        "runStatus": run.get("runStatus"),
        "reviewStatus": run.get("reviewStatus"),
        "startedAt": run.get("startedAt"),
        "summary": run.get("summary"),
        "errors": run.get("errors") or [],
        "warnings": run.get("warnings") or [],
        "nextActions": run.get("nextActions") or [],
        "rawReportExcerpt": raw,
    }


def build_prompt(targets: list[dict]) -> str:
    payload = json.dumps(targets, ensure_ascii=False, indent=2)
    return (
        "あなたは進捗管理アプリの作業履歴レビュアーです。\n"
        "以下は progress の execution-runs のうち未レビュー / 要追跡 / partial・failed の Run です。\n"
        "ファイルの書き換えやコマンド実行は不要です。読んで判断するだけにしてください。\n\n"
        "各 Run について日本語で:\n"
        "1. 一行レビュー要約\n"
        "2. リスク・気になる点（あれば）\n"
        "3. 改善 ToDo 候補（最大3つ、命令形）\n"
        "最後に全体として優先度の高い ToDo を3つ挙げてください。\n\n"
        f"=== 対象 Run ({len(targets)}件) ===\n{payload}\n"
    )


def run_codex(prompt: str) -> int:
    codex = shutil.which("codex")
    if not codex:
        print("[ERROR] codex CLI が見つかりません", file=sys.stderr)
        return 3
    args = [
        codex,
        "exec",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--color",
        "never",
        prompt,
    ]
    print(f"[INFO] codex 実行 (read-only, timeout={CODEX_TIMEOUT_SEC}s)…\n", flush=True)
    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=CODEX_TIMEOUT_SEC,
            cwd="/root/company/apps/ny01/progress/experiments/codex-sdk",
        )
    except subprocess.TimeoutExpired:
        print(f"[ERROR] codex タイムアウト ({CODEX_TIMEOUT_SEC}s)", file=sys.stderr)
        return 3
    print("=" * 60)
    print("[codex stdout]")
    print(proc.stdout.strip() or "(空)")
    if proc.stderr.strip():
        print("-" * 60)
        print("[codex stderr (末尾)]")
        print("\n".join(proc.stderr.strip().splitlines()[-8:]))
    print("=" * 60)
    print(f"[INFO] exit code: {proc.returncode}")
    return 0 if proc.returncode == 0 else 3


def main() -> int:
    ap = argparse.ArgumentParser(description="Codex SDK 読み取り専用実験")
    ap.add_argument("--runs-file", default=DEFAULT_RUNS_FILE)
    ap.add_argument("--limit", type=int, default=8, help="codex に渡す最大件数")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="抽出のみ表示し codex を呼ばない",
    )
    args = ap.parse_args()

    runs = load_runs(args.runs_file)
    targets_all = [compact_run(r) for r in runs if needs_review(r)]
    print(f"[INFO] 全 {len(runs)} 件中、レビュー対象 {len(targets_all)} 件")
    for t in targets_all:
        print(
            f"  - {t['runId']} | {t['targetApp']} | run={t['runStatus']} "
            f"review={t['reviewStatus']} | {(t['targetTodoTitle'] or '')[:40]}"
        )

    if not targets_all:
        print("[INFO] レビュー対象なし。終了します。")
        return 0

    targets = targets_all[: args.limit]
    if len(targets) < len(targets_all):
        print(f"[INFO] --limit={args.limit} のため先頭 {len(targets)} 件を codex に渡します")

    if args.dry_run:
        print("[INFO] --dry-run のため codex は呼びません。")
        return 0

    prompt = build_prompt(targets)
    return run_codex(prompt)


if __name__ == "__main__":
    sys.exit(main())
