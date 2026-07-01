// progress 状態スナップショット生成 + メール送信
// 既存の obsidian-vault/00_inbox/progress-状態スナップショット.{md,html} と同形式で最新データから再生成し、
// HTML をメール本文(text/html)として MAIL_TO へ送る。
import fs from 'fs'
import path from 'path'
import nodemailer from '/root/company/apps/ny01/progress/node_modules/nodemailer/lib/nodemailer.js'

const PROG = '/root/company/apps/ny01/progress'
const VAULT_OUT = '/root/company/obsidian-vault/00_inbox'

// --- env ---
const env = fs.readFileSync(path.join(PROG, '.env.local'), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1')
}

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(PROG, p), 'utf8'))

const goals = readJson('data/real/goals.json').goals
const cfg = readJson('data/real/automation-config.json')
const candWrap = readJson('data/real/app-factory-candidates.json')
const cands = candWrap.candidates || []
const runsRaw = JSON.parse(fs.readFileSync(path.join(PROG, 'data/real/execution-runs.json'), 'utf8'))
const runs = (Array.isArray(runsRaw) ? runsRaw : (runsRaw.runs || runsRaw.executionRuns || []))
  .slice()
  .sort((a, b) => Date.parse(b.finishedAt || b.startedAt || 0) - Date.parse(a.finishedAt || a.startedAt || 0))

// --- 集計 ---
const statusCount = {}
for (const g of goals) statusCount[g.status] = (statusCount[g.status] || 0) + 1
const ns = goals.find((g) => g.isNorthStar)

const projAgg = {}
for (const g of goals) {
  const p = g.projectId || '(未分類)'
  projAgg[p] = projAgg[p] || { total: 0, done: 0 }
  projAgg[p].total++
  if (g.status === 'done') projAgg[p].done++
}
const projRows = Object.entries(projAgg).sort((a, b) => b[1].total - a[1].total)

// アプリ概要承認のラベル: 既存アプリ系=作成不要 / それ以外=未判断
const appLabel = (s) => (s === 'ready_to_ship' || s === 'active' ? '作成不要' : '未判断')

// 最近の自動実行の人間語化
const humanize = (r) => {
  const t = r.targetTodoTitle || ''
  if (t.includes('Factory schedule')) return '今回は自動実行できる作業がなく待機'
  if (t.includes('収益化候補 定期取り込み')) return '収益化候補をVaultから点検'
  const s = (r.summary || '').replace(/\s+/g, ' ').trim()
  return s.length > 110 ? s.slice(0, 110) + '…' : s
}
const statusBadge = (s) =>
  s === 'completed' ? ['b-done', '完了'] : s === 'partial' ? ['b-partial', '一部'] : s === 'failed' ? ['b-failed', '失敗'] : ['b-running', '実行中']
const fmt = (iso) => {
  const d = new Date(iso)
  const j = new Date(d.getTime() + 9 * 3600 * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`
}
const now = new Date()
const genStamp = fmt(now.toISOString())
const recent = runs.slice(0, 12)

// --- HTML ---
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Progress 状態スナップショット ${genStamp}</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;background:#f4f6f8;color:#1a202c;line-height:1.6;-webkit-text-size-adjust:100%}
.wrap{max-width:680px;margin:0 auto;padding:16px}
h1{font-size:20px;margin:8px 0}h2{font-size:15px;margin:20px 0 8px;padding-bottom:4px;border-bottom:2px solid #3b82f6}
.sub{color:#718096;font-size:12px;margin-bottom:16px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.tile{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center}
.tile .v{font-size:22px;font-weight:800;color:#2563eb}.tile .l{font-size:11px;color:#718096}
.badge{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700}
.b-done{background:#dcfce7;color:#166534}.b-partial{background:#fef9c3;color:#854d0e}.b-failed{background:#fee2e2;color:#991b1b}.b-running{background:#dbeafe;color:#1e40af}
.row{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:6px 0;border-bottom:1px solid #f1f5f9}
.small{font-size:12px;color:#4a5568}
.ttl{font-weight:700;font-size:13px}
</style></head><body><div class="wrap">
<h1>📊 Progress 状態スナップショット</h1>
<div class="sub">生成: ${genStamp} JST ／ オフライン閲覧可（このメール単体で見られます）</div>
<h2>🏭 AI工場の状態</h2><div class="grid">
<div class="tile"><div class="v">${cfg.factoryEnabled ? '稼働中' : '停止'}</div><div class="l">自動実行</div></div>
<div class="tile"><div class="v">${cfg.factoryMaxPerEpic}</div><div class="l">1サイクル深掘り回数</div></div>
<div class="tile"><div class="v">${statusCount.active || 0}</div><div class="l">進行中ゴール</div></div>
<div class="tile"><div class="v">${statusCount.proposed || 0}</div><div class="l">承認待ちゴール</div></div>
</div>
<h2>🎯 ゴール状況</h2>
<div class="card small">合計 ${goals.length}件 ／ 進行中 ${statusCount.active || 0} ・ 達成 ${statusCount.done || 0} ・ 承認待ち ${statusCount.proposed || 0} ・ 保留 ${statusCount.paused || 0} ・ 取下 ${statusCount.dropped || 0}</div>
${ns ? `<div class="card"><div class="ttl">⭐ North Star</div><div class="small">${esc(ns.title)}（${ns.current}/${ns.target}）</div></div>` : ''}
<h2>📁 プロジェクト別の達成</h2><div class="card">
${projRows.map(([p, v]) => `<div class="row"><span>${esc(p)}</span><span class="small">${v.done}/${v.total} 達成（${Math.round((v.done / v.total) * 100)}%）</span></div>`).join('\n')}
</div>
<h2>📱 アプリ概要承認</h2><div class="card">
${cands.map((c) => `<div class="row"><span class="ttl">${esc(c.title)}</span><span class="small">${appLabel(c.status)}（${esc(c.status)}）</span></div>`).join('\n')}
</div>
<h2>🤖 最近の自動実行（記録）</h2>
${recent.map((r) => { const [cls, lbl] = statusBadge(r.runStatus); return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px"><span class="ttl">${esc(r.targetTodoTitle || '')}</span><span class="badge ${cls}">${lbl}</span></div><div class="small" style="margin-top:4px">${esc(humanize(r))}</div><div class="small" style="color:#a0aec0;margin-top:2px">${fmt(r.finishedAt || r.startedAt)} ／ ${esc(r.targetApp || '')}</div></div>` }).join('\n')}
</div></body></html>`

// --- Markdown ---
const md = `# 📊 Progress 状態スナップショット

> 生成: ${genStamp} JST ／ オフライン閲覧用（自動生成）

## 🏭 AI工場の状態
- 自動実行: **${cfg.factoryEnabled ? '稼働中' : '停止'}** ／ 1サイクル深掘り回数: ${cfg.factoryMaxPerEpic}
- 進行中ゴール ${statusCount.active || 0} ／ 承認待ち ${statusCount.proposed || 0}

## 🎯 ゴール状況
- 合計 ${goals.length}件：進行中 ${statusCount.active || 0} ・ 達成 ${statusCount.done || 0} ・ 承認待ち ${statusCount.proposed || 0} ・ 保留 ${statusCount.paused || 0} ・ 取下 ${statusCount.dropped || 0}
${ns ? `- ⭐ North Star: ${ns.title}（${ns.current}/${ns.target}）` : ''}

## 📁 プロジェクト別の達成
${projRows.map(([p, v]) => `- ${p}: ${v.done}/${v.total} 達成（${Math.round((v.done / v.total) * 100)}%）`).join('\n')}

## 📱 アプリ概要承認
${cands.map((c) => `- ${c.title} — ${appLabel(c.status)}（${c.status}）`).join('\n')}

## 🤖 最近の自動実行（記録）
${recent.map((r) => { const [, lbl] = statusBadge(r.runStatus); const icon = r.runStatus === 'completed' ? '✅完了' : r.runStatus === 'partial' ? '🟡一部' : r.runStatus === 'failed' ? '🔴失敗' : '🔵実行中'; return `- ${icon} **${r.targetTodoTitle || ''}** — ${humanize(r)}  \n  　${fmt(r.finishedAt || r.startedAt)} ／ ${r.targetApp || ''}` }).join('\n')}

---
*このファイルは progress アプリの現在状態をオフラインで確認するための自動生成スナップショットです。*
`

fs.mkdirSync(VAULT_OUT, { recursive: true })
fs.writeFileSync(path.join(VAULT_OUT, 'progress-状態スナップショット.html'), html)
fs.writeFileSync(path.join(VAULT_OUT, 'progress-状態スナップショット.md'), md)
console.log('snapshot regenerated:', genStamp, '| goals', goals.length, '| recent', recent.length)

// --- send ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})
const to = process.env.MAIL_TO
const info = await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to,
  subject: `📊 Progress 状態スナップショット ${genStamp}`,
  text: md,
  html,
  attachments: [{ filename: 'progress-snapshot.html', content: html, contentType: 'text/html; charset=utf-8' }],
})
console.log('SENT to', to, '| messageId', info.messageId, '| accepted', JSON.stringify(info.accepted))
