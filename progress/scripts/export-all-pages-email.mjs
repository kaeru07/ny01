// progress 全ページ + 全タブを起動中アプリ(3010)から取得し、CSSインライン化・JS除去のうえ
// 自前のvanilla-JSタブバーで切替できる自己完結HTML(目次付き)を1ファイルに束ねてメール送信する。
// タブ/フィルタはサーバー側でクエリ反映されるため、各タブのクエリURLを取得して全パネルを埋め込む。
import fs from 'fs'
import path from 'path'
import nodemailer from '/root/company/apps/ny01/progress/node_modules/nodemailer/lib/nodemailer.js'

const PROG = '/root/company/apps/ny01/progress'
const BASE = 'http://localhost:3010'
const OUT_DIR = '/tmp/claude-0/-root-company/1e248f14-5771-40a6-9dfb-d9f7f6cd8c95/scratchpad'

const env = fs.readFileSync(path.join(PROG, '.env.local'), 'utf8')
for (const line of env.split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1')
}

const routes = [
  '/', '/morning', '/daily', '/decide', '/inbox', '/approvals',
  '/queue', '/prompt-queue', '/tasks', '/tasks/import',
  '/projects', '/projects/new', '/projects/import', '/project-goals', '/project-complete',
  '/goal-dashboard', '/goal-planner', '/recommended-epics', '/epic', '/epic/new', '/factory/candidates',
  '/app-proposals', '/app-urls', '/portfolio',
  '/automation', '/activity', '/logs', '/usage', '/decisions',
  '/monetization', '/revenue', '/radar', '/research-flow', '/report',
  '/integration-map', '/ai-drive', '/codex', '/guide', '/verify-todos',
  '/legacy', '/legacy/home',
]

// タブとして扱うクエリパラメータ（少数値の切替軸のみ。goalId/projectId/q等の詳細・検索は除外）
const ALLOW_TAB_PARAMS = new Set(['tab', 'period', 'mode', 'type', 'status', 'view', 'executor', 'reviewStatus'])
// クライアントstateでhrefを出さないページの補完（サーバーはクエリを反映する）
const SUPPLEMENT = {
  '/tasks': [['status', 'todo'], ['status', 'in_progress'], ['status', 'done'], ['status', 'blocked'], ['status', 'paused'], ['status', 'queued']],
  '/queue': [['tab', 'reviews'], ['status', 'executable'], ['status', 'ai_hold'], ['status', 'blocked'], ['status', 'manual'], ['status', 'done']],
  '/goal-planner': [['status', 'active'], ['status', 'proposed'], ['status', 'done'], ['status', 'paused']],
  '/goal-dashboard': [['status', 'active'], ['status', 'proposed'], ['status', 'done'], ['status', 'skipped']],
}
const MAX_VARIANTS = 8

const AUTH = (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD)
  ? 'Basic ' + Buffer.from(`${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASSWORD}`).toString('base64')
  : undefined
const fetchText = async (url) => {
  const headers = { 'user-agent': 'snapshot-export' }
  if (AUTH) headers['authorization'] = AUTH
  const res = await fetch(url, { headers, redirect: 'follow' })
  return { ok: res.ok, status: res.status, body: await res.text() }
}

const cssCache = new Map()
const collectCss = async (html) => {
  for (const m of html.matchAll(/<link[^>]+href="(\/_next\/static\/css\/[^"]+)"/g)) {
    const clean = m[1].split('?')[0]
    if (!cssCache.has(clean)) {
      try { const r = await fetchText(BASE + clean); if (r.ok) cssCache.set(clean, r.body) } catch {}
    }
  }
}

const extractBody = (html) => {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let body = m ? m[1] : html
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<template[\s\S]*?<\/template>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/ on[a-z]+="[^"]*"/gi, '')
    .replace(/href="[^"]*"/gi, 'href="#"') // 内部遷移は無効化（切替は自前タブバーで行う）
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const slug = (s) => (s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root')

// ページの実HTMLから同一パスのクエリ違いリンクを抽出（タブ軸パラメータのみ採用）
const discoverVariants = (route, html) => {
  const found = []
  const seen = new Set()
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    let href = m[1]
    if (!href.includes('?')) continue
    // 絶対/相対を吸収
    let p, qs
    if (href.startsWith('?')) { p = route; qs = href.slice(1) }
    else { const u = href.split('?'); p = u[0]; qs = u[1] }
    if (p !== route) continue
    const params = new URLSearchParams(qs)
    const keys = [...params.keys()].filter((k) => params.get(k))
    // 単一のタブ軸パラメータのみ（複合や詳細リンクは除外）
    if (keys.length !== 1) continue
    const k = keys[0]
    if (!ALLOW_TAB_PARAMS.has(k)) continue
    const v = params.get(k)
    const sig = `${k}=${v}`
    if (seen.has(sig)) continue
    seen.add(sig)
    found.push([k, v])
  }
  return found
}

const tabLabel = (k, v) => (k === 'tab' || k === 'status' || k === 'mode' || k === 'view') ? v : `${k}:${v}`

const now = new Date()
const j = new Date(now.getTime() + 9 * 3600 * 1000)
const pad = (n) => String(n).padStart(2, '0')
const stamp = `${j.getUTCFullYear()}-${pad(j.getUTCMonth() + 1)}-${pad(j.getUTCDate())} ${pad(j.getUTCHours())}:${pad(j.getUTCMinutes())}`

const pages = []
const failed = []
for (const route of routes) {
  try {
    const base = await fetchText(BASE + route)
    if (!base.ok) { failed.push(`${route}(${base.status})`); continue }
    await collectCss(base.body)
    // タブ軸の収集: 自動抽出 + 補完マップ
    const variantPairs = []
    const seen = new Set()
    const push = (k, v) => { const s = `${k}=${v}`; if (!seen.has(s)) { seen.add(s); variantPairs.push([k, v]) } }
    for (const [k, v] of discoverVariants(route, base.body)) push(k, v)
    for (const [k, v] of (SUPPLEMENT[route] || [])) push(k, v)

    const panels = [{ label: 'デフォルト', body: extractBody(base.body) }]
    for (const [k, v] of variantPairs.slice(0, MAX_VARIANTS)) {
      try {
        const r = await fetchText(`${BASE}${route}?${k}=${encodeURIComponent(v)}`)
        if (r.ok) panels.push({ label: tabLabel(k, v), body: extractBody(r.body) })
      } catch {}
    }
    pages.push({ route, id: 'pg-' + slug(route), panels })
  } catch (e) {
    failed.push(`${route}(${String(e).slice(0, 30)})`)
  }
}

const allCss = [...cssCache.values()].join('\n')
const toc = pages.map((p) => `<li><a href="#${p.id}">${esc(p.route)}</a>${p.panels.length > 1 ? ` <span style="color:#94a3b8">(${p.panels.length}タブ)</span>` : ''}</li>`).join('')

const renderPage = (p) => {
  const tabs = p.panels
    .map((pn, i) => `<button type="button" class="pg-tab${i === 0 ? ' active' : ''}" data-group="${p.id}" data-idx="${i}">${esc(pn.label)}</button>`)
    .join('')
  const panels = p.panels
    .map((pn, i) => `<div class="pg-panel${i === 0 ? ' active' : ''}" data-group="${p.id}" data-idx="${i}">${pn.body}</div>`)
    .join('\n')
  return `<section id="${p.id}" class="pg-export-section">
<div class="pg-export-head">📄 <strong>${esc(p.route)}</strong> <a href="#toc" style="font-size:12px;margin-left:8px">▲ 目次へ</a></div>
${p.panels.length > 1 ? `<div class="pg-tabbar">${tabs}</div>` : ''}
${panels}
</section>`
}

const doc = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Progress 全ページ書き出し ${stamp}</title>
<style>${allCss}</style>
<style>
.pg-export-wrap{max-width:900px;margin:0 auto;padding:12px;font-family:-apple-system,"Hiragino Kaku Gothic ProN",sans-serif}
.pg-export-toc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin-bottom:16px}
.pg-export-toc ul{columns:2;-webkit-columns:2;margin:8px 0 0;padding-left:18px;font-size:13px}
.pg-export-section{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;margin:12px 0;overflow-x:auto}
.pg-export-head{position:sticky;top:0;background:#eff6ff;border-bottom:2px solid #3b82f6;padding:6px 8px;margin:-8px -12px 8px;font-size:14px;z-index:50}
.pg-tabbar{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;padding-bottom:6px;border-bottom:1px dashed #cbd5e1}
.pg-tab{border:1px solid #cbd5e1;background:#f8fafc;color:#334155;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700;cursor:pointer}
.pg-tab.active{background:#2563eb;color:#fff;border-color:#2563eb}
.pg-panel{display:none}
.pg-panel.active{display:block}
</style>
</head><body><div class="pg-export-wrap">
<h1 id="toc">📚 Progress 全ページ書き出し</h1>
<div style="color:#718096;font-size:12px;margin-bottom:12px">生成: ${stamp} JST ／ オフライン閲覧可 ／ 取得 ${pages.length} ページ ／ タブは下のボタンで切替できます（表示専用・データ操作は無効）</div>
<div class="pg-export-toc"><strong>目次（${pages.length}ページ）</strong><ul>${toc}</ul>${failed.length ? `<div style="color:#991b1b;font-size:12px;margin-top:8px">取得不可: ${esc(failed.join(', '))}</div>` : ''}</div>
${pages.map(renderPage).join('\n')}
</div>
<script>
document.addEventListener('click', function (e) {
  var b = e.target.closest('.pg-tab'); if (!b) return;
  var g = b.getAttribute('data-group'), idx = b.getAttribute('data-idx');
  document.querySelectorAll('.pg-tab[data-group="' + g + '"]').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-idx') === idx); });
  document.querySelectorAll('.pg-panel[data-group="' + g + '"]').forEach(function (x) { x.classList.toggle('active', x.getAttribute('data-idx') === idx); });
});
</script>
</body></html>`

fs.mkdirSync(OUT_DIR, { recursive: true })
const outPath = path.join(OUT_DIR, 'progress-all-pages.html')
fs.writeFileSync(outPath, doc)
const totalTabs = pages.reduce((a, p) => a + p.panels.length, 0)
console.log('pages:', pages.length, '/ total panels:', totalTabs, '/ failed:', failed.join(', ') || 'none')
console.log('css inlined:', cssCache.size, '/ doc MB:', (Buffer.byteLength(doc) / 1048576).toFixed(2))

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})
const to = process.env.MAIL_TO
const info = await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to,
  subject: `📚 Progress 全ページ書き出し（タブ切替対応版）${stamp}`,
  text: `progress 全ページのオフライン閲覧用HTMLを添付します（タブ切替対応版）。\n生成: ${stamp} JST ／ 取得 ${pages.length} ページ ／ 合計 ${totalTabs} タブ\n添付 progress-all-pages.html を開き、各ページのタブボタンで表を切り替えてください（表示専用）。`,
  attachments: [{ filename: 'progress-all-pages.html', content: doc, contentType: 'text/html; charset=utf-8' }],
})
console.log('SENT to', to, '| messageId', info.messageId, '| accepted', JSON.stringify(info.accepted))
