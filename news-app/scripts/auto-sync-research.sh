#!/usr/bin/env bash
# auto-sync-research.sh
#
# 役割:
#   朝の日次調査フロー（hermes-market-research）が Vault(06_research) を更新した後に呼ばれ、
#   news-app 同梱の content/research を Vault 最新へ同期し、差分があれば ny01 リポジトリへ
#   commit / push する。push により Vercel が自動再デプロイし、本番 /research が最新日付に追いつく。
#
# 背景:
#   Vercel には Vault 本体が存在しないため、resolveResearchRoot() は同梱 content/research に
#   フォールバックする（lib/research/vault.ts）。この同梱コピーは git にコミットされた内容だけが
#   Vercel に反映されるため、定期的に同期 + push する必要がある。
#
# 呼び出し元:
#   - /root/company/scripts/hermes/run-market-research.sh の末尾（朝 07:00 systemd timer）
#   - 手動実行も可: bash news-app/scripts/auto-sync-research.sh
#
# 設計（epic-vault-4suq doneCriteria 対応）:
#   - 同期は scripts/sync-research-content.mjs（破壊削除なし）に委譲
#   - 差分がある場合のみ commit / push（no-diff は no-op で正常終了）
#   - add 対象は news-app/content/research 配下のみに限定（想定外パスは検知して中止）
#   - 高信頼度の機密パターンをスキャンし、ヒット時は push せず中止
#   - 失敗・成功とも専用ログへ記録（呼び出し元の朝フローは止めない方針）
#
# 制約:
#   - main への通常 push のみ（force push しない）
#   - .env / 認証情報には触れない

set -uo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # .../news-app
REPO_DIR="$(cd "$APP_DIR/.." && pwd)"                         # .../ny01 (git root)
CONTENT_REL="news-app/content/research"
LOG_FILE="/root/company/logs/news-app-research-sync.log"
DATE="$(date +%Y-%m-%d)"

mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "[$(date -Iseconds)] [auto-sync-research] $*" | tee -a "$LOG_FILE"; }

log "===== auto-sync-research start (date=$DATE) ====="

# 1) Vault -> 同梱 content/research 同期
if ! node "$APP_DIR/scripts/sync-research-content.mjs" >>"$LOG_FILE" 2>&1; then
  log "sync-research-content.mjs FAILED (rc=$?) — 中止（朝フローは継続）"
  exit 1
fi
log "sync-research-content.mjs ok"

cd "$REPO_DIR" || { log "FATAL: cd repo failed: $REPO_DIR"; exit 2; }

# 2) 差分が無ければ no-op
git add -- "$CONTENT_REL" 2>>"$LOG_FILE" || { log "git add FAILED (rc=$?)"; exit 3; }
if git diff --cached --quiet -- "$CONTENT_REL"; then
  log "no changes in $CONTENT_REL — nothing to commit"
  log "===== auto-sync-research end (no-diff) ====="
  exit 0
fi

# 3) staged が想定外パスを含まないか確認
staged_unexpected="$(git -c core.quotepath=false diff --cached --name-only | grep -vE "^${CONTENT_REL}/" || true)"
if [[ -n "$staged_unexpected" ]]; then
  log "UNEXPECTED STAGED PATHS (outside ${CONTENT_REL}/) — RESETTING & abort:"
  while IFS= read -r line; do log "  $line"; done <<< "$staged_unexpected"
  git reset HEAD -- "$CONTENT_REL" >/dev/null 2>&1 || true
  exit 4
fi

# 4) 高信頼度の機密スキャン（ヒットしたら push せず中止）
HIGH_CONF_REGEX='(^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{30,}|-----BEGIN ([A-Z ]+)?(PRIVATE )?KEY-----|(^|[^A-Za-z0-9])Bearer [A-Za-z0-9._\-]{20,}'
staged_files=()
while IFS= read -r f; do [[ -n "$f" ]] && staged_files+=("$REPO_DIR/$f"); done \
  < <(git diff --cached --name-only -- "$CONTENT_REL")
if [[ ${#staged_files[@]} -gt 0 ]]; then
  if grep -E -l "$HIGH_CONF_REGEX" "${staged_files[@]}" >/dev/null 2>&1; then
    log "HIGH-CONFIDENCE SECRET PATTERN DETECTED — PUSH BLOCKED. staged reset."
    git reset HEAD -- "$CONTENT_REL" >/dev/null 2>&1 || true
    exit 5
  fi
fi

# 5) commit & push
LATEST="$(ls "$APP_DIR/content/research/daily-ai-news" 2>/dev/null | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$' | sort | tail -1 | sed 's/\.md$//')"
COMMIT_MSG="chore(news-app): auto-sync research content to ${LATEST:-$DATE} (hermes daily)"
if git commit -m "$COMMIT_MSG" >>"$LOG_FILE" 2>&1; then
  COMMIT_HASH="$(git rev-parse --short HEAD)"
  log "git commit ok: $COMMIT_HASH — $COMMIT_MSG"
else
  log "git commit FAILED (rc=$?)"
  exit 6
fi

if git push origin main >>"$LOG_FILE" 2>&1; then
  log "git push ok: origin/main (Vercel auto-deploy triggered)"
else
  log "git push FAILED (rc=$?) — commit は残るが GitHub 未反映。手動 push 要"
  exit 7
fi

log "===== auto-sync-research end (ok, commit=$COMMIT_HASH) ====="
exit 0
