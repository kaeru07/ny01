// send-run-report-email.mjs
// 自動実行（Factory / schedule）の「直近の成果・進捗・停滞・改善事項」を
// ユーザー向けにわかりやすい HTML にまとめ、MAIL_TO へ送信する。
//
// 強調ポイント:
//   - あなたの対応が必要（自動実行では解決できない = 承認待ち / 不具合）を最上部に赤で目立たせる
//   - 各ゴールの進捗・問題・やるべきアクションを 1 つずつ追記する
//
// 使い方:
//   node scripts/send-run-report-email.mjs            # 直近サイクルを送信
//   node scripts/send-run-report-email.mjs --dry-run  # 送信せず HTML を出力
//   WINDOW_HOURS=48 node scripts/send-run-report-email.mjs   # 集計窓（既定 48h）
import fs from 'fs'
import path from 'path'
import nodemailer from '/root/company/apps/ny01/progress/node_modules/nodemailer/lib/nodemailer.js'

const PROG = '/root/company/apps/ny01/progress'
const DRY = process.argv.includes('--dry-run')
const WINDOW_HOURS = Number(process.env.WINDOW_HOURS || 48)

// --- env 読み込み ---
const envRaw = fs.readFileSync(path.join(PROG, '.env.local'), 'utf8')
for (const line of envRaw.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1')
}

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(PROG, p), 'utf8'))
const runs = (readJson('data/real/execution-runs.json').runs || [])
  .slice().sort((a, b) => Date.parse(b.finishedAt || b.startedAt || 0) - Date.parse(a.finishedAt || a.startedAt || 0))
const goals = readJson('data/real/goals.json').goals
const goalsById = new Map(goals.map((g) => [g.id, g]))
const approvals = (() => { const a = readJson('data/real/approvals.json'); return a.approvals || a.items || (Array.isArray(a) ? a : []) })()
const runsById = new Map(runs.map((r) => [r.runId, r]))
// システム自己点検（自動実行が毎回 recordUrgentIssues で書き出す。factory→email の順なので最新）。
const urgent = (() => { try { return readJson('data/real/urgent-issues.json') } catch { return { generatedAt: '', issues: [] } } })()
const urgentIssues = urgent.issues || []

// --- helpers ---
const now = Date.now()
const JST = (iso) => {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—'
  const j = new Date(d.getTime() + 9 * 3600 * 1000); const p = (n) => String(n).padStart(2, '0')
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`
}
const hoursAgo = (iso) => (now - Date.parse(iso || 0)) / 3600000
const daysAgo = (iso) => Math.floor(hoursAgo(iso) / 24)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const MACHINE_RE = /considered=|executed=|\[review-fix\]|Factory schedule|収益化候補 定期取り込み|追加0\/更新0/
const humanize = (summary) => {
  let t = String(summary ?? '').replace(/\r/g, '\n').split('\n').map((l) => l.trim()).find(Boolean) || ''
  t = t.replace(/^\[factory-runner[^\]]*\]\s*/i, '').replace(/\bexecutor=\S+/g, '').replace(/^\s*(?:[-*・]\s*)+/, '').replace(/\s+/g, ' ').trim()
  return t.length > 120 ? t.slice(0, 120) + '…' : t
}
const goalTitleForRun = (r) =>
  (r.selection?.selectedGoalKey && goalsById.get(r.selection.selectedGoalKey)?.title) || r.selection?.selectedGoalTitle || ''

const AUTO_SOURCES = new Set(['schedule', 'boot', 'factory_runner', 'prompt_queue', 'review_fix', 'monetization_sync'])
const isAuto = (r) => AUTO_SOURCES.has(r.source) || r.factoryRun === true
const windowRuns = runs.filter((r) => hoursAgo(r.finishedAt || r.startedAt) <= WINDOW_HOURS)
const latestEnvelope = runs.find((r) => r.source === 'schedule' || r.source === 'boot')

// ===== ① あなたの対応が必要（自動実行では解決できない） =====
// (A) 承認待ち = 人間の判断が要るもの。billing/secret は危険判断で自動実行が止まる。
const DANGER_CATS = new Set(['billing', 'secret', 'production_risk', 'external_publish', 'destructive'])
const CAT_LABEL = { multi_option: '方針の選択', executor_fallback: '実行者の切替', billing: '課金の判断', secret: '認証・秘密情報の判断', production_risk: '本番影響の判断', external_publish: '公開・申請の判断', destructive: '破壊的操作の判断' }
const pendingApprovals = approvals.filter((a) => a.status === 'pending')
// レビュー型（問題なし/フォローアップを含む）＝完了済み作業の事後確認。危険ゲートから除外され自動実行は止めない。
const isReviewType = (opts) => opts.some((l) => /問題なし|フォローアップ/.test(l))
const approvalItems = pendingApprovals.map((a) => {
  const opts = (a.options || []).map((o) => o.label)
  const recLabel = (a.options || []).find((o) => o.key === a.recommended)?.label
  const reviewType = isReviewType(opts)
  const danger = DANGER_CATS.has(a.category)
  // 実際に自動実行を止めるのは「危険カテゴリ かつ 非レビュー型（実行前判断）」だけ。
  const blocking = danger && !reviewType
  const goalId = runsById.get(a.createdRunId)?.selection?.selectedGoalKey
  let action
  if (blocking) action = `⚠️ ${CAT_LABEL[a.category] || a.category}（実行前判断）です。progress の「今日の判断」で承認/却下を決めてください。決まるまで自動実行はこの範囲を止めています。`
  else if (danger && reviewType) action = `完了済み作業の事後確認です（自動実行は止まりません）。内容を見て問題なければ承認、気になれば修正を依頼してください。`
  else if (a.category === 'executor_fallback') action = 'progress の「今日の判断」で、Claudeで続けるか止めるかを選んでください（自動再開の設定でも回避できます）。'
  else action = `progress の「今日の判断」で選択してください${recLabel ? `（推奨: ${recLabel}）` : `（${opts.slice(0, 3).join(' / ')}）`}。`
  return { danger, blocking, reviewType, category: a.category, title: humanize(a.title), reason: humanize(a.reason || ''), action, goalId, when: JST(a.createdAt), opts }
}).sort((x, y) => (y.blocking - x.blocking) || (y.danger - x.danger))

// (B) 不具合っぽくて自動実行内で解決できないもの
const bugItems = []
// running のまま止まっている（オーファン）
for (const r of runs.filter((r) => r.runStatus === 'running' && hoursAgo(r.startedAt) > 2)) {
  bugItems.push({ kind: 'orphan', title: humanize(r.targetTodoTitle || r.summary), detail: `${Math.floor(hoursAgo(r.startedAt))}時間「実行中」のまま停止`, when: JST(r.startedAt), goalId: r.selection?.selectedGoalKey,
    action: 'progress で該当の実行を確認し、再実行するか中止してください（自動回収は未実装のため人手が必要）。' })
}
// 直近が失敗で止まっている（自動リトライでも直っていない）ゴール
const byGoalRuns = {}
for (const r of runs) { const k = r.selection?.selectedGoalKey; if (k) (byGoalRuns[k] = byGoalRuns[k] || []).push(r) }
for (const [gid, rs] of Object.entries(byGoalRuns)) {
  rs.sort((a, b) => Date.parse(b.finishedAt || b.startedAt) - Date.parse(a.finishedAt || a.startedAt))
  const last = rs[0]
  if (last && last.runStatus === 'failed') {
    const g = goalsById.get(gid)
    if (g && g.status === 'active') {
      const err = (last.errors || [])[0] || humanize(last.summary)
      bugItems.push({ kind: 'failed', title: g.title, detail: `直近の自動実行が失敗: ${String(err).slice(0, 80)}`, when: JST(last.finishedAt), goalId: gid,
        action: '失敗内容を確認し、方針の修正か手動対応が必要です（自動リトライでは解消していません）。' })
    }
  }
}

// ===== ② 各ゴールの進捗・問題・アクション =====
const pendingByGoal = {}
for (const it of approvalItems) if (it.goalId) (pendingByGoal[it.goalId] = pendingByGoal[it.goalId] || []).push(it)

function goalProgressPct(g) {
  const cur = Number(g.current), tgt = Number(g.target)
  if (!Number.isFinite(cur) || !Number.isFinite(tgt)) return null
  if (g.metricDirection === 'down') {
    if (cur <= tgt) return 100
    // baseline 不明のため cur を起点に目標到達度を近似（目標が0なら未達扱い）
    return tgt <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((tgt / cur) * 100)))
  }
  if (tgt <= 0) return null
  return Math.max(0, Math.min(100, Math.round((cur / tgt) * 100)))
}

const activeGoals = goals.filter((g) => g.status === 'active')
  .sort((a, b) => (a.isNorthStar === b.isNorthStar ? 0 : a.isNorthStar ? -1 : 1) || (Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0)))
  .map((g) => {
    const rs = (byGoalRuns[g.id] || [])
    const cc = { completed: 0, partial: 0, failed: 0, running: 0 }
    for (const r of rs) cc[r.runStatus] = (cc[r.runStatus] || 0) + 1
    const last = rs[0]
    const pend = pendingByGoal[g.id] || []
    const pct = goalProgressPct(g)
    const todosDone = (g.todos || []).filter((t) => t.done || t.status === 'done').length
    const todosTotal = (g.todos || []).length

    // 問題を 1 つに絞る（優先度順）
    let problem, action, sev = 'ok'
    if (pend.some((p) => p.blocking)) { sev = 'high'; problem = '実行前の危険判断の承認待ち（このゴールの自動実行が停止中）'; action = '「今日の判断」で承認/却下を決めてください。' }
    else if (pend.some((p) => p.danger && p.reviewType)) { sev = 'warn'; problem = '完了作業の事後確認が未処理（自動実行は止まっていません）'; action = '「今日の判断」で確認してください（急ぎではありません）。' }
    else if (pend.length) { sev = 'warn'; problem = `方針の判断待ち ${pend.length}件`; action = '「今日の判断」で選択してください。' }
    else if (last && last.runStatus === 'running' && hoursAgo(last.startedAt) > 2) { sev = 'high'; problem = `実行が${Math.floor(hoursAgo(last.startedAt))}時間止まったまま（オーファン）`; action = '該当実行を確認し再実行/中止してください。' }
    else if (last && last.runStatus === 'failed') { sev = 'high'; problem = '直近の自動実行が失敗（リトライでも未解消）'; action = 'エラー内容を確認し方針修正/手動対応が必要です。' }
    else if (rs.length === 0) { sev = 'warn'; problem = 'まだ一度も着手されていない'; action = 'ゴールに紐づくEpic生成・承認が滞っていないか確認してください。' }
    else if (last && daysAgo(last.finishedAt) >= 14) { sev = 'warn'; problem = `${daysAgo(last.finishedAt)}日間停滞（最後の実行が古い）`; action = 'まだ必要なゴールか見直し、不要なら完了/保留にしてください。' }
    else if (cc.completed === 0 && cc.partial > 0) { sev = 'warn'; problem = `完了に届いていない（一部完了${cc.partial}回）`; action = '完了条件(doneCriteria)が厳しすぎないか、残作業を確認してください。' }
    else { problem = '順調に進行中'; action = '—' }

    return {
      title: g.title, project: g.projectId || '—', priority: g.priority, northStar: !!g.isNorthStar,
      metricText: g.metric ? `${g.current ?? '—'} → ${g.target ?? '—'} ${g.metric}${g.metricDirection === 'down' ? '（下げる）' : ''}` : '',
      pct, todosText: todosTotal ? `ToDo ${todosDone}/${todosTotal}` : '',
      runsText: rs.length ? `実行${rs.length}回（完了${cc.completed}/一部${cc.partial}/失敗${cc.failed}）` : '実行なし',
      lastText: last ? `最終 ${JST(last.finishedAt || last.startedAt)}・${last.runStatus}` : '—',
      problem, action, sev,
    }
  })

// ===== ③b リリース準備度チェック（アプリ系ゴールのみ / 基準: build・型lint / privacy URL / スクショ・メタ）=====
const INFRA_PROJECTS = new Set(['company-mgmt', 'progress', 'ny01/progress', 'try-research', 'autoexec-test-proj'])
const PRIVACY_DIR = '/root/company/apps/kaeru07.github.io/privacy'
const appRepoDir = (slug) => ['/root/company/apps/ny01/' + slug, '/root/company/apps/generated/' + slug, '/root/company/apps/' + slug].find((d) => { try { return fs.statSync(d).isDirectory() } catch { return false } })
const existsAny = (dir, names) => names.some((n) => { try { return fs.existsSync(path.join(dir, n)) } catch { return false } })
const latestRunForApp = (proj, slug) => runs.find((r) => { const t = (r.targetApp || '').toLowerCase(); return t === proj.toLowerCase() || t === slug.toLowerCase() || t.includes(slug.toLowerCase()) })

const releaseTargets = goals
  .filter((g) => g.status === 'active' && g.projectId && !INFRA_PROJECTS.has(g.projectId) && (g.id.startsWith('goal-app-') || (g.title || '').includes('作る') || (g.title || '').includes('トレーナー') || (g.title || '').includes('アプリ')))
  .map((g) => {
    const slug = g.projectId.replace(/^ny01[-/]/, '')
    const dir = appRepoDir(slug)
    const last = latestRunForApp(g.projectId, slug)
    const checks = last?.checks || {}
    const okStr = (v) => v && /ok|pass|成功|✓/i.test(v)
    const ngStr = (v) => v && /ng|fail|error|✗/i.test(v)
    const buildOk = (okStr(checks.typescript) || okStr(checks.build)) && !ngStr(checks.lint) && !ngStr(checks.typescript) && !ngStr(checks.build)
    const privacyOk = fs.existsSync(path.join(PRIVACY_DIR, slug + '.html'))
    const metaOk = !!dir && existsAny(dir, ['ios']) && existsAny(dir, ['screenshots', '.screenshots', 'fastlane', 'store', 'metadata'])
    const crit = [
      { label: 'build・型/lint', ok: buildOk },
      { label: 'プライバシーURL', ok: privacyOk },
      { label: 'スクショ/メタ', ok: metaOk },
    ]
    const done = crit.filter((c) => c.ok).length
    return { title: g.title, slug, crit, done, total: crit.length, ready: done === crit.length, missing: crit.filter((c) => !c.ok).map((c) => c.label) }
  })
  .sort((a, b) => b.done - a.done)
// ===== ③c ゴール進行タイムライン（ガント風）: 各アクティブゴールの作成→最終活動を共通時間軸のバーで表示 =====
const ganttRows = (() => {
  const items = goals.filter((g) => g.status === 'active')
  if (!items.length) return []
  const rows = items.map((g) => {
    const created = Date.parse(g.createdAt || g.updatedAt || '') || now
    const rs = byGoalRuns[g.id] || []
    const lastRunT = rs.length ? Math.max(...rs.map((r) => Date.parse(r.finishedAt || r.startedAt) || 0)) : 0
    const lastAct = Math.max(Date.parse(g.updatedAt || '') || 0, lastRunT) || created
    const lastStatus = rs.length ? rs[0].runStatus : ''
    const idle = Math.floor((now - lastAct) / 86400000)
    const sev = idle >= 14 ? 'stall' : lastStatus === 'failed' ? 'fail' : 'ok'
    return { title: g.title, northStar: !!g.isNorthStar, created, lastAct, idle, runs: rs.length, sev }
  })
  const tMin = Math.min(...rows.map((r) => r.created), now)
  const span = Math.max(now - tMin, 86400000)
  return rows.sort((a, b) => a.created - b.created).map((r) => {
    const startPct = Math.max(0, Math.min(98, ((r.created - tMin) / span) * 100))
    const endPct = Math.max(startPct + 2, Math.min(100, ((r.lastAct - tMin) / span) * 100))
    return { ...r, startPct, widthPct: endPct - startPct, gapPct: 100 - endPct }
  })
})()
const GANTT_COLOR = { ok: '#4f46e5', stall: '#d97706', fail: '#dc2626' }
const ganttHtml = ganttRows.length
  ? `<div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">← 古いゴール　　　　　時間軸　　　　　現在 →</div>${ganttRows.map((r) => `<div style="margin:0 0 8px;"><div style="font-size:12px;color:#374151;margin-bottom:2px;">${r.northStar ? '⭐ ' : ''}${esc(r.title.slice(0, 32))} <span style="color:#9ca3af;font-size:10px;">実行${r.runs}・最終${r.idle}日前</span></div><div style="background:#f1f5f9;border-radius:4px;height:13px;font-size:0;white-space:nowrap;"><span style="display:inline-block;width:${r.startPct.toFixed(1)}%;height:13px;"></span><span style="display:inline-block;width:${r.widthPct.toFixed(1)}%;height:13px;background:${GANTT_COLOR[r.sev]};border-radius:4px;"></span><span style="display:inline-block;width:${r.gapPct.toFixed(1)}%;height:13px;"></span></div></div>`).join('')}<div style="font-size:10px;color:#9ca3af;margin-top:2px;">■青=進行中 ■橙=14日以上停滞 ■赤=直近失敗／バー右端が現在から離れているほど放置</div>`
  : empty('アクティブなゴールがありません。')

const achievements = windowRuns
  .filter((r) => r.runStatus === 'completed' && (r.changedFiles || []).length > 0 && !MACHINE_RE.test(r.summary || ''))
  .map((r) => ({ app: r.targetApp || '—', text: /\[判断要求\]|推奨:|\s\|\s/.test(r.summary || '') ? humanize(r.targetTodoTitle) : humanize(r.summary || r.targetTodoTitle), files: (r.changedFiles || []).length, when: JST(r.finishedAt || r.startedAt), auto: isAuto(r), goal: goalTitleForRun(r) }))

const nextSet = new Map()
for (const r of windowRuns) for (const a of r.nextActions || []) {
  const key = String(a).replace(/\s+/g, ' ').trim().slice(0, 140)
  if (key && !MACHINE_RE.test(key) && !nextSet.has(key)) nextSet.set(key, { text: key, app: r.targetApp })
}
const nextActions = [...nextSet.values()].slice(0, 8)

const c = { total: windowRuns.length, auto: windowRuns.filter(isAuto).length, completed: windowRuns.filter((r) => r.runStatus === 'completed').length, partial: windowRuns.filter((r) => r.runStatus === 'partial').length, failed: windowRuns.filter((r) => r.runStatus === 'failed').length, files: windowRuns.reduce((s, r) => s + (r.changedFiles || []).length, 0) }

// --- HTML ---
const badge = (label, color) => `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:${color}20;color:${color};">${label}</span>`
const section = (emoji, title, inner, color = '#6366f1') => `<div style="margin:22px 0 0;"><h2 style="font-size:16px;margin:0 0 10px;color:#111827;border-left:4px solid ${color};padding-left:10px;">${emoji} ${title}</h2>${inner}</div>`
const empty = (msg) => `<p style="margin:0;color:#6b7280;font-size:13px;">${msg}</p>`
const sevColor = { high: '#dc2626', warn: '#d97706', ok: '#16a34a' }

// 要対応（最上部・目立たせる）
const attnCount = approvalItems.length + bugItems.length
// 実際に自動実行を止めている/不具合（最優先）と、確認だけ（急ぎでない）を分ける。
const stoppingCount = bugItems.length + approvalItems.filter((i) => i.blocking).length
const confirmOnlyCount = attnCount - stoppingCount
const cardAttn = (icon, tag, tagColor, title, reason, action, when) => `
  <div style="border:1px solid ${tagColor}40;background:${tagColor}0d;border-radius:10px;padding:12px 14px;margin:0 0 10px;">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
      ${badge(icon + ' ' + tag, tagColor)}<span style="color:#9ca3af;font-size:11px;">${when}</span>
    </div>
    <div style="font-size:14px;font-weight:600;color:#111827;margin:8px 0 2px;">${esc(title)}</div>
    ${reason ? `<div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${esc(reason)}</div>` : ''}
    <div style="font-size:13px;color:#b91c1c;background:#fff;border-radius:6px;padding:7px 9px;"><b>やること:</b> ${esc(action)}</div>
  </div>`
const MAX_APPROVAL_CARDS = 15
let attnHtml = ''
if (attnCount === 0) attnHtml = empty('あなたの対応が必要な項目はありません。自動実行だけで回っています。')
else {
  // 不具合（オーファン/失敗）は全件、承認は危険優先で上位のみカード表示し、残りは件数サマリ。
  attnHtml += bugItems.map((it) => cardAttn('🐛', it.kind === 'orphan' ? '停止（オーファン）' : '不具合・失敗', '#dc2626', it.title, it.detail, it.action, it.when)).join('')
  const shown = approvalItems.slice(0, MAX_APPROVAL_CARDS)
  const rest = approvalItems.slice(MAX_APPROVAL_CARDS)
  attnHtml += shown.map((it) => cardAttn(
    it.blocking ? '🔴' : it.danger ? '🟡' : '🟠',
    it.blocking ? '危険判断・実行停止中' : it.danger ? '完了作業の事後確認（実行は継続）' : (CAT_LABEL[it.category] || '判断待ち'),
    it.blocking ? '#dc2626' : it.danger ? '#ca8a04' : '#d97706',
    it.title, it.reason, it.action, it.when)).join('')
  if (rest.length) {
    const restByCat = {}
    for (const it of rest) restByCat[CAT_LABEL[it.category] || it.category] = (restByCat[CAT_LABEL[it.category] || it.category] || 0) + 1
    attnHtml += `<div style="border:1px dashed #fca5a5;border-radius:10px;padding:10px 14px;font-size:13px;color:#b91c1c;">ほか承認待ちが <b>${rest.length}件</b>あります（${Object.entries(restByCat).map(([k, v]) => `${k} ${v}`).join(' / ')}）。<br><span style="color:#374151;">👉 progress の「今日の判断」を開いて上から順に処理してください。</span></div>`
  }
}

// ゴール別カード
const goalCards = activeGoals.map((g) => `
  <div style="border:1px solid #eef2ff;border-radius:10px;padding:12px 14px;margin:0 0 10px;">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
      <div style="font-size:14px;font-weight:700;color:#111827;">${g.northStar ? '⭐ ' : ''}${esc(g.title)}</div>
      ${badge(g.priority || 'normal', g.priority === 'high' ? '#dc2626' : '#6b7280')}
    </div>
    <div style="color:#9ca3af;font-size:11px;margin:2px 0 8px;">${esc(g.project)}${g.metricText ? ' ・ ' + esc(g.metricText) : ''}</div>
    ${g.pct != null ? `<div style="background:#f1f5f9;border-radius:999px;height:8px;overflow:hidden;margin:6px 0;"><div style="width:${g.pct}%;height:8px;background:${g.pct >= 100 ? '#16a34a' : '#6366f1'};"></div></div><div style="font-size:11px;color:#6b7280;margin-bottom:6px;">達成度 約${g.pct}%${g.todosText ? ' ・ ' + esc(g.todosText) : ''}</div>` : (g.todosText ? `<div style="font-size:11px;color:#6b7280;">${esc(g.todosText)}</div>` : '')}
    <div style="font-size:12px;color:#6b7280;margin:4px 0;">${esc(g.runsText)} ・ ${esc(g.lastText)}</div>
    <div style="font-size:13px;margin-top:6px;"><span style="color:${sevColor[g.sev]};font-weight:600;">${g.sev === 'ok' ? '✅' : g.sev === 'high' ? '🔴' : '🟠'} 問題:</span> <span style="color:#374151;">${esc(g.problem)}</span></div>
    ${g.action !== '—' ? `<div style="font-size:13px;margin-top:3px;"><span style="color:#4f46e5;font-weight:600;">👉 やること:</span> <span style="color:#374151;">${esc(g.action)}</span></div>` : ''}
  </div>`).join('')

const achHtml = achievements.length
  ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">${achievements.map((a) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 6px;vertical-align:top;white-space:nowrap;color:#6b7280;font-size:12px;">${a.when}</td><td style="padding:8px 6px;vertical-align:top;">${a.auto ? badge('自動', '#16a34a') : badge('手動', '#94a3b8')} <span style="color:#374151;">${esc(a.text)}</span><div style="color:#9ca3af;font-size:11px;margin-top:2px;">${esc(a.app)}${a.goal ? ' ・ 🎯 ' + esc(a.goal) : ''} ・ ${a.files}ファイル変更</div></td></tr>`).join('')}</table>`
  : empty('新しく完了した作業はありません。')
const nextHtml = nextActions.length
  ? `<ul style="margin:0;padding-left:18px;font-size:13px;color:#374151;">${nextActions.map((n) => `<li style="margin:3px 0;">${esc(n.text)}${n.app ? ` <span style="color:#9ca3af;font-size:11px;">(${esc(n.app)})</span>` : ''}</li>`).join('')}</ul>`
  : empty('次アクションの候補はありません。')
const envHtml = latestEnvelope
  ? `<div style="font-size:13px;color:#374151;">${esc(humanize(latestEnvelope.summary))}</div><div style="color:#9ca3af;font-size:11px;margin-top:4px;">${JST(latestEnvelope.finishedAt || latestEnvelope.startedAt)} 実行</div>`
  : empty('スケジュール実行の記録がありません。')

const headline = achievements.length > 0
  ? `直近 ${WINDOW_HOURS}時間で <b>${achievements.length}件</b>完了・<b>${c.files}ファイル</b>変更。最優先(停止/不具合): <b style="color:#dc2626;">${stoppingCount}件</b> ／ 確認だけ: ${confirmOnlyCount}件。`
  : `直近 ${WINDOW_HOURS}時間は仕込み中心。最優先(停止/不具合): <b style="color:#dc2626;">${stoppingCount}件</b> ／ 確認だけ: ${confirmOnlyCount}件。`

const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px 22px;color:#fff;">
      <div style="font-size:12px;opacity:.85;">Progress 自動実行レポート</div>
      <div style="font-size:20px;font-weight:700;margin-top:2px;">直近の作業まとめ</div>
      <div style="font-size:12px;opacity:.85;margin-top:6px;">生成 ${JST(new Date().toISOString())}（直近${WINDOW_HOURS}時間）</div>
    </div>
    <div style="padding:8px 22px 22px;">
      ${stoppingCount > 0
        ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;margin:14px 0 4px;font-size:14px;color:#b91c1c;font-weight:700;">🚨 いま自動実行を止めている/不具合が ${stoppingCount} 件（最優先）${confirmOnlyCount > 0 ? `<span style="font-weight:400;color:#9a3412;"> ／ ほか確認だけ ${confirmOnlyCount} 件（急ぎでない）</span>` : ''}</div>`
        : (confirmOnlyCount > 0 ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin:14px 0 4px;font-size:14px;color:#92400e;font-weight:600;">🟡 自動実行を止めている項目はありません。確認だけの項目が ${confirmOnlyCount} 件あります（急ぎでない）</div>` : '')}
      <p style="font-size:14px;color:#111827;margin:12px 0 4px;line-height:1.6;">${headline}</p>
      <div style="margin:12px 0;display:flex;gap:8px;flex-wrap:wrap;">
        ${badge('自動実行 ' + c.auto + '回', '#16a34a')} ${badge('完了 ' + c.completed, '#2563eb')} ${badge('一部 ' + c.partial, '#d97706')} ${badge('失敗 ' + c.failed, '#dc2626')} ${badge('変更 ' + c.files + 'ファイル', '#7c3aed')}
      </div>
      ${section('🩺', 'システム自己点検（自動実行が毎回チェック）', (urgentIssues.length
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">${urgentIssues.map((i) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:7px 6px;vertical-align:top;white-space:nowrap;">${badge(i.severity === 'high' ? '重要' : '注意', i.severity === 'high' ? '#dc2626' : '#d97706')}</td><td style="padding:7px 6px;"><span style="color:#111827;font-weight:600;">${esc(i.title)}</span><div style="color:#9ca3af;font-size:11px;margin-top:2px;">${esc((i.detail || '').slice(0, 120))}</div></td></tr>`).join('')}</table><div style="color:#9ca3af;font-size:11px;margin-top:6px;">点検時刻: ${urgent.generatedAt ? JST(urgent.generatedAt) : '—'}</div>`
        : `<p style="margin:0;color:#16a34a;font-size:13px;">✅ 自己点検で異常は検出されていません（点検 ${urgent.generatedAt ? JST(urgent.generatedAt) : '—'}）。</p>`), urgentIssues.some((i) => i.severity === 'high') ? '#dc2626' : '#16a34a')}
      ${section('🚨', 'あなたの対応が必要（自動実行では解決できません）', attnHtml, '#dc2626')}
      ${section('🚀', 'App Store リリース準備度（アプリ系ゴール）', (releaseTargets.length
        ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">${releaseTargets.map((r) => `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 6px;vertical-align:top;">${badge(r.ready ? 'リリース可' : r.done + '/' + r.total, r.ready ? '#16a34a' : r.done >= 2 ? '#d97706' : '#dc2626')}</td><td style="padding:8px 6px;"><span style="color:#111827;font-weight:600;">${esc(r.title)}</span><div style="font-size:11px;margin-top:3px;">${r.crit.map((c) => `<span style="color:${c.ok ? '#16a34a' : '#9ca3af'};margin-right:8px;">${c.ok ? '✓' : '✗'} ${esc(c.label)}</span>`).join('')}</div>${r.missing.length ? `<div style="color:#b45309;font-size:11px;margin-top:2px;">未達: ${esc(r.missing.join(' / '))}</div>` : '<div style="color:#16a34a;font-size:11px;margin-top:2px;">全基準クリア。ストア提出可。</div>'}</td></tr>`).join('')}</table>`
        : empty('アプリ系ゴールがありません。')), '#0ea5e9')}
      ${section('📊', 'ゴール進行タイムライン（ガント）', ganttHtml, '#6366f1')}
      ${section('🎯', 'ゴール別の進捗・問題・やること', goalCards || empty('進行中のゴールはありません。'), '#4f46e5')}
      ${section('🕒', '直近のスケジュール実行', envHtml)}
      ${section('✅', 'できるようになったこと・完了した作業', achHtml, '#16a34a')}
      ${section('💡', '改善事項・次にやること', nextHtml)}
      <p style="margin:24px 0 0;font-size:11px;color:#9ca3af;border-top:1px solid #f1f5f9;padding-top:12px;">progress アプリの ExecutionRun / Goal / 承認キューから自動生成。詳細は progress 画面（http://localhost:3010）で確認できます。</p>
    </div>
  </div>
</body></html>`

const subject = `[Progress] 自動実行レポート ${JST(new Date().toISOString())} — 要対応${attnCount}件 / 完了${c.completed}・変更${c.files}ファイル`

// ===== 外部AI(ChatGPT/Codex)レビュー用 Markdown パケット =====
// そのまま ChatGPT に貼れば状態レビューを依頼できる自己完結フォーマット（末尾に構造化JSON同梱）。
const blockingApprovals = approvalItems.filter((i) => i.blocking)
const posthocApprovals = approvalItems.filter((i) => i.danger && i.reviewType)
const dangerApprovals = approvalItems.filter((i) => i.danger)
const normalApprovals = approvalItems.filter((i) => !i.danger)
const nowJst = JST(new Date().toISOString())
const mdList = (arr, fn) => (arr.length ? arr.map(fn).join('\n') : '- （なし）')
const reviewMd = `# Progress 自動実行 状態レビュー依頼（${nowJst} 時点）

## 0. レビュー依頼文（このままレビューしてください）
あなたは個人開発の自動実行基盤(Progress)のレビュアーです。以下は Progress の自動実行(AI工場)の現在状態スナップショットです。次の観点でレビューし、具体的な指示に落として返してください。
1. **要対応(承認待ち/不具合)の優先順位**は妥当か。今すぐ人間が判断すべき上位3件は？
2. **危険判断(課金/認証)**で自動実行が止まっている。各項目、承認/却下どちらを推すか（理由つき）。
3. **停滞ゴール(2週間以上)**は継続・保留・破棄のどれにすべきか、1件ずつ判定。
4. **本来は自動実行で解決できるはずなのに人手に回っている**ものはないか（仕組みの穴）。
5. **不具合(オーファン/失敗)**の根本原因の当たりと、再発防止の1手。
6. 各ゴールの**問題→やること**の妥当性。もっと良いアクションがあれば差し替え。
7. 全体として、次の1週間で**着手すべき順に3つ**挙げるなら？
8. このレポート自体に**足りない情報**があれば指摘。

---

## 0.5 全体像（前提：このシステムは何か）
- **Progress** は複数アプリ（麻雀/将棋/ニュース等・各独立リポ）を横断管理する「AI工場」の司令塔。永続状態（Goal/Epic/ExecutionRun/承認）を JSON で持つ唯一の正本。
- **自動実行フロー**: systemd timer（1日4回 11/14/16/23時 JST）→ Progress API → \`runFactory\` が「実行可能な Goal/Epic を選ぶ→プロンプト生成→AIを1回起動→機械チェック(tsc/lint)→完了判定→次へ」を人間の介入なしで回す。1 Run ごとに AI をステートレスに起動（セッションは持ち越さない＝クラッシュに強いが毎回コンテキスト再構築）。
- **AI役割（現状）**: Claude Code=基本実行者（実装/調査/検証）、Codex=Claude上限時のフォールバック実装（安全シグナル限定）。※レビュー・完了判定は現状「ルールベース(正規表現/類似度)」で LLM 未使用。実知能は起動される Claude/Codex の中だけ。
- **人間の役割(human-in-the-loop)**: 危険操作（課金/認証/本番/公開）と方針選択は自動実行できず「今日の判断(承認キュー)」に積まれ、人間が決めるまで該当範囲の自動実行は止まる。← 本レポートの「要対応」がこれ。
- **既知の弱点**: 完了判定がヒューリスティックで曖昧 / 実行中のまま残る"オーファン"の自動回収が未実装 / retry系統が複数 / Codexを実装主体に使えていない。
- **目的**: できるだけ人手なしで開発・調査を前進させつつ、危険・不可逆・課金は必ず人間が承認する。

---

## 1. 数値サマリ（直近${WINDOW_HOURS}時間）
- 自動実行: ${c.auto}回 / 完了 ${c.completed} ・ 一部 ${c.partial} ・ 失敗 ${c.failed} ・ 変更 ${c.files}ファイル
- 要対応合計: **${attnCount}件** ＝ 最優先(自動実行を止めている/不具合) **${stoppingCount}件** ＋ 確認だけ(急ぎでない) ${confirmOnlyCount}件
- 内訳: 実行前の危険判断(実際に停止) **${blockingApprovals.length}件** / 完了作業の事後確認(停止しない) ${posthocApprovals.length}件 / 実行中オーファン ${bugItems.filter((b) => b.kind === 'orphan').length}件 / 直近失敗ゴール ${bugItems.filter((b) => b.kind === 'failed').length}件
- 進行中ゴール: ${activeGoals.length}件

## 2. 🔴 実行前の危険判断（実際に自動実行を止めている＝最優先）
${mdList(blockingApprovals, (i) => `- **[${CAT_LABEL[i.category] || i.category}]** ${i.title}\n  - 理由: ${i.reason || '—'}\n  - 選択肢: ${i.opts.join(' / ') || '承認/却下'}\n  - 推奨アクション: ${i.action}`)}

### 2b. 🟡 完了作業の事後確認（危険カテゴリだが自動実行は止めない・急ぎでない）
${mdList(posthocApprovals.slice(0, 10), (i) => `- [${CAT_LABEL[i.category] || i.category}] ${i.title}`)}
${posthocApprovals.length > 10 ? `- …ほか ${posthocApprovals.length - 10}件（多くは同種の重複。今後はアプリ単位で1件に集約されます）` : ''}

## 3. 🐛 不具合（自動実行内で解決できない）
${mdList(bugItems, (i) => `- **[${i.kind === 'orphan' ? '停止/オーファン' : '直近失敗'}]** ${i.title}\n  - 状況: ${i.detail}（${i.when}）\n  - 推奨アクション: ${i.action}`)}

## 4. 🟠 その他の判断待ち（方針選択など）
${mdList(normalApprovals.slice(0, 30), (i) => `- [${CAT_LABEL[i.category] || i.category}] ${i.title}${i.opts.length ? `（${i.opts.slice(0, 3).join(' / ')}）` : ''}`)}
${normalApprovals.length > 30 ? `- …ほか ${normalApprovals.length - 30}件` : ''}

## 5. 🎯 ゴール別 状態（進捗 / 問題 / やること）
${mdList(activeGoals, (g) => `### ${g.northStar ? '⭐ ' : ''}${g.title}
- プロジェクト: ${g.project} / 優先度: ${g.priority || 'normal'}${g.metricText ? ` / 指標: ${g.metricText}` : ''}${g.pct != null ? ` / 達成度 約${g.pct}%` : ''}
- 進捗: ${g.runsText} ・ ${g.lastText}
- 問題: ${g.problem}
- やること: ${g.action}`)}

## 6. ✅ 直近できるようになったこと
${mdList(achievements, (a) => `- ${a.text}（${a.app}${a.goal ? ' / 🎯' + a.goal : ''} / ${a.files}ファイル / ${a.when} / ${a.auto ? '自動' : '手動'}）`)}

## 7. 💡 改善事項・次アクション候補
${mdList(nextActions, (n) => `- ${n.text}${n.app ? `（${n.app}）` : ''}`)}

## 8. 構造化スナップショット（プログラム/AI解析用 JSON）
\`\`\`json
${JSON.stringify({
  generatedAt: new Date().toISOString(),
  windowHours: WINDOW_HOURS,
  counts: c,
  attention: {
    total: attnCount,
    dangerApprovals: dangerApprovals.map((i) => ({ category: i.category, title: i.title, options: i.opts })),
    bugs: bugItems.map((i) => ({ kind: i.kind, title: i.title, detail: i.detail })),
    otherApprovals: normalApprovals.map((i) => ({ category: i.category, title: i.title })),
  },
  goals: activeGoals.map((g) => ({ title: g.title, project: g.project, priority: g.priority, pct: g.pct, runs: g.runsText, last: g.lastText, problem: g.problem, action: g.action, severity: g.sev })),
  achievements: achievements.map((a) => ({ text: a.text, app: a.app, files: a.files, auto: a.auto })),
  nextActions: nextActions.map((n) => n.text),
}, null, 2)}
\`\`\`
`

const outPath = path.join(PROG, '.tmp-run-report.html')
const mdPath = path.join(PROG, '.tmp-run-report-review.md')
fs.writeFileSync(outPath, html)
fs.writeFileSync(mdPath, reviewMd)
const mdFilename = `progress-review-${nowJst.replace(/[-: ]/g, '').slice(0, 12)}.md`
if (DRY) {
  console.log('[dry-run] ->', outPath); console.log('subject:', subject)
  console.log(`要対応=${attnCount}(承認${approvalItems.length}/不具合${bugItems.length}) goals=${activeGoals.length} achievements=${achievements.length} next=${nextActions.length}`)
  console.log('危険判断:', approvalItems.filter((i) => i.danger).length, '/ orphan:', bugItems.filter((b) => b.kind === 'orphan').length, '/ failed:', bugItems.filter((b) => b.kind === 'failed').length)
  process.exit(0)
}
const to = process.env.MAIL_TO
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !to) { console.error('SMTP/MAIL_TO 不足'); process.exit(1) }
const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
const info = await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to,
  subject,
  html,
  text: 'このメールは HTML 版です。progress 画面をご確認ください。添付の Markdown は ChatGPT 等の外部AIレビュー用です。',
  attachments: [
    { filename: mdFilename, content: reviewMd, contentType: 'text/markdown; charset=utf-8' },
  ],
})
console.log('sent:', info.messageId, '->', to, '/ attached:', mdFilename)
