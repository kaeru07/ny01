#!/usr/bin/env bash
# Factory runner を 1 回起動する（既定 dry_run）。systemd/cron から呼ぶ。
# 環境変数: MODE(dry_run|manual|auto, 既定 dry_run) / MAX_RUNS(既定3) / CONFIRM(1でauto実起動)
set -euo pipefail
MODE="${MODE:-dry_run}"
MAX_RUNS="${MAX_RUNS:-3}"
CONFIRM_FLAG="false"
[ "${CONFIRM:-0}" = "1" ] && CONFIRM_FLAG="true"
PROGRESS_URL="${PROGRESS_URL:-http://localhost:3010}"
curl -s -X POST "$PROGRESS_URL/api/operations/factory-run" \
  -H 'Content-Type: application/json' \
  -d "{\"mode\":\"$MODE\",\"maxRuns\":$MAX_RUNS,\"confirm\":$CONFIRM_FLAG}"
echo
