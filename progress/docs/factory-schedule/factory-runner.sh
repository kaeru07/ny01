#!/usr/bin/env bash
# Factory runner を 1 回起動する（既定 dry_run）。systemd/cron から呼ぶ。
# 環境変数: MODE(dry_run|manual|auto, 既定 dry_run) / CONFIRM(1でauto実起動)
set -euo pipefail
MODE="${MODE:-dry_run}"
CONFIRM_FLAG="false"
[ "${CONFIRM:-0}" = "1" ] && CONFIRM_FLAG="true"
PROGRESS_URL="${PROGRESS_URL:-http://localhost:3010}"

# Basic認証(progress保護)対応: .env.local から認証情報を読み curl に付与。無ければ空。
ENV_FILE="${PROGRESS_ENV_FILE:-/root/company/apps/ny01/progress/.env.local}"
AUTH_ARGS=()
if [ -f "${ENV_FILE}" ]; then
  BA_USER="$(grep -E '^BASIC_AUTH_USER=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
  BA_PASS="$(grep -E '^BASIC_AUTH_PASSWORD=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
  if [ -n "${BA_USER}" ] && [ -n "${BA_PASS}" ]; then
    AUTH_ARGS=(-u "${BA_USER}:${BA_PASS}")
  fi
fi

curl -s ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} -X POST "$PROGRESS_URL/api/operations/factory-run" \
  -H 'Content-Type: application/json' \
  -d "{\"mode\":\"$MODE\",\"confirm\":$CONFIRM_FLAG}"
echo
