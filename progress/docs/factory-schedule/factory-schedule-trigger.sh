#!/usr/bin/env bash
# factory-schedule-trigger.sh
# スケジューラ（systemd timer / cron / boot service）から Factory を起動する入口スクリプト。
# 実体ロジック（ON/OFF・blocked 判定・二重起動防止・ExecutionRun 記録）は progress アプリ側
# (/api/operations/factory-schedule) に集約している。このスクリプトは「叩くだけ」。
#
# 使い方:
#   factory-schedule-trigger.sh <source> <trigger>
#     source : schedule | boot      （既定: schedule）
#     trigger: systemd | cron | startup （既定: systemd）
#
# 環境変数（任意）:
#   PROGRESS_BASE_URL: progress の URL（既定 http://localhost:3010）
#   FACTORY_SCHEDULE_LOG_DIR: ログ出力先（既定 /root/company/logs）
#   FACTORY_EXECUTOR_TIMEOUT_MS: executor 1 Run の上限（既定 1500000ms=25分）
#   FACTORY_SCHEDULE_HTTP_TIMEOUT_SECONDS: API応答待機上限の明示上書き
#
# 例:
#   定時(systemd): factory-schedule-trigger.sh schedule systemd
#   定時(cron)   : factory-schedule-trigger.sh schedule cron
#   起動時       : factory-schedule-trigger.sh boot startup

set -euo pipefail

SOURCE="${1:-schedule}"
TRIGGER="${2:-systemd}"
BASE_URL="${PROGRESS_BASE_URL:-http://localhost:3010}"
LOG_DIR="${FACTORY_SCHEDULE_LOG_DIR:-/root/company/logs}"
LOG_FILE="${LOG_DIR}/factory-schedule.log"
EXECUTOR_TIMEOUT_MS="${FACTORY_EXECUTOR_TIMEOUT_MS:-1500000}"
HTTP_TIMEOUT_OVERRIDE="${FACTORY_SCHEDULE_HTTP_TIMEOUT_SECONDS:-}"
SAFETY_RUN_LIMIT=3

# Basic認証(progress保護)対応: .env.local から認証情報を読み、curl に -u を付与する。
# 認証情報が無ければ AUTH_ARGS は空のまま（未保護環境でもそのまま動く）。
ENV_FILE="${PROGRESS_ENV_FILE:-/root/company/apps/ny01/progress/.env.local}"
AUTH_ARGS=()
if [ -f "${ENV_FILE}" ]; then
  BA_USER="$(grep -E '^BASIC_AUTH_USER=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
  BA_PASS="$(grep -E '^BASIC_AUTH_PASSWORD=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
  if [ -n "${BA_USER}" ] && [ -n "${BA_PASS}" ]; then
    AUTH_ARGS=(-u "${BA_USER}:${BA_PASS}")
  fi
fi

mkdir -p "${LOG_DIR}"
ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] [$SOURCE/$TRIGGER] $*" >>"${LOG_FILE}"; }

# boot 時は progress(3010) がまだ立ち上がっていない可能性があるため、最大 60 秒待つ。
wait_for_health() {
  local i
  for i in $(seq 1 30); do
    if curl -sf -m 5 ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} "${BASE_URL}/api/operations/factory-status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

log "trigger start"

if ! wait_for_health; then
  log "ABORT: progress(${BASE_URL}) に到達できません（起動待ちタイムアウト）"
  exit 1
fi

PAYLOAD="{\"source\":\"${SOURCE}\",\"trigger\":\"${TRIGGER}\"}"

# HTTP側がexecutorより先に切れると、実行中なのに「POST失敗」と誤記録される。
# Epic Run合計 + 前後Runner最大10分 + 後処理2分を待てる値に揃える。
if [[ "${HTTP_TIMEOUT_OVERRIDE}" =~ ^[0-9]+$ ]] && (( HTTP_TIMEOUT_OVERRIDE > 0 )); then
  HTTP_TIMEOUT_SECONDS="${HTTP_TIMEOUT_OVERRIDE}"
else
  if ! [[ "${EXECUTOR_TIMEOUT_MS}" =~ ^[0-9]+$ ]] || (( EXECUTOR_TIMEOUT_MS <= 0 )); then
    EXECUTOR_TIMEOUT_MS=1500000
  fi
  EXECUTOR_TIMEOUT_SECONDS=$(( (EXECUTOR_TIMEOUT_MS + 999) / 1000 ))
  HTTP_TIMEOUT_SECONDS=$(( SAFETY_RUN_LIMIT * EXECUTOR_TIMEOUT_SECONDS + 720 ))
fi

log "request timeout=${HTTP_TIMEOUT_SECONDS}s safetyRunLimit=${SAFETY_RUN_LIMIT} executorTimeoutMs=${EXECUTOR_TIMEOUT_MS}"

RESPONSE="$(curl -sf -m "${HTTP_TIMEOUT_SECONDS}" ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} -X POST "${BASE_URL}/api/operations/factory-schedule" \
  -H 'Content-Type: application/json' \
  -d "${PAYLOAD}" || true)"

if [ -z "${RESPONSE}" ]; then
  log "ERROR: 空レスポンス（POST 失敗の可能性）"
  exit 1
fi

log "result: ${RESPONSE}"

# 自動実行1回ごとにレポートメールを送る（成果/進捗/停滞/要対応 + 外部AIレビュー用MD添付）。
# 送信失敗しても trigger 全体は成功のまま（メールは付随機能）。REPORT_EMAIL=off で無効化可。
if [ "${REPORT_EMAIL:-on}" != "off" ]; then
  REPORT_NODE="${REPORT_NODE_BIN:-/usr/bin/node}"
  REPORT_SCRIPT="/root/company/apps/ny01/progress/scripts/send-run-report-email.mjs"
  if "${REPORT_NODE}" "${REPORT_SCRIPT}" >>"${LOG_FILE}" 2>&1; then
    log "report email: sent"
  else
    log "report email: FAILED (rc=$?) — 本体は成功扱い"
  fi
fi

echo "${RESPONSE}"
