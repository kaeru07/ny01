'use client'

import { useEffect, useState } from 'react'

// 【麻雀問題ビルダー】UIから自分の手牌・全員の捨て牌・設問を入力して
// apps/mahjong の問題集へ追加する。progress 配下の /mahjong-builder。

type Seat = 'self' | 'shimocha' | 'toimen' | 'kamicha'
type TileGroup = { name: string; tiles: string[] }
type Target = { kind: 'hand' } | { kind: 'discard'; seat: Seat } | { kind: 'dora' }

const SEAT_ORDER: Seat[] = ['self', 'shimocha', 'toimen', 'kamicha']
const SEAT_LABEL: Record<Seat, string> = { self: '自分', shimocha: '下家', toimen: '対面', kamicha: '上家' }

export default function MahjongBuilderPage() {
  const [tileGroups, setTileGroups] = useState<TileGroup[]>([])
  const [total, setTotal] = useState(0)

  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [explanation, setExplanation] = useState('')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [bakaze, setBakaze] = useState('東')
  const [kyoku, setKyoku] = useState(1)
  const [tagsText, setTagsText] = useState('')

  const [hand, setHand] = useState<string[]>([])
  const [dora, setDora] = useState<string[]>([])
  const [discards, setDiscards] = useState<Record<Seat, string[]>>({ self: [], shimocha: [], toimen: [], kamicha: [] })

  const [choices, setChoices] = useState<{ key: string; label: string }[]>([
    { key: 'A', label: '' }, { key: 'B', label: '' }, { key: 'C', label: '' }, { key: 'D', label: '' },
  ])
  const [answer, setAnswer] = useState('')

  const [target, setTarget] = useState<Target>({ kind: 'hand' })
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/mahjong-builder', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { setTileGroups(d.tileGroups ?? []); setTotal(d.total ?? 0) })
      .catch(() => setMsg({ type: 'err', text: '読み込みに失敗しました' }))
  }, [])

  function addTile(t: string) {
    if (target.kind === 'hand') {
      if (hand.length >= 14) return
      setHand((h) => [...h, t])
    } else if (target.kind === 'dora') {
      setDora((d) => [...d, t])
    } else {
      setDiscards((d) => ({ ...d, [target.seat]: [...d[target.seat], t] }))
    }
  }
  function popHand() { setHand((h) => h.slice(0, -1)) }
  function popDora() { setDora((d) => d.slice(0, -1)) }
  function popDiscard(seat: Seat) { setDiscards((d) => ({ ...d, [seat]: d[seat].slice(0, -1) })) }
  function clearAll() {
    setHand([]); setDora([]); setDiscards({ self: [], shimocha: [], toimen: [], kamicha: [] })
  }

  async function save() {
    setSaving(true); setMsg(null)
    try {
      const body = {
        title, question, explanation, difficulty,
        bakaze, kyoku,
        tags: tagsText.split(/[,、\s]+/).map((s) => s.trim()).filter(Boolean),
        dora, hand, discards,
        choices: choices.filter((c) => c.label.trim()),
        answer,
      }
      const res = await fetch('/api/mahjong-builder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '保存に失敗しました')
      setMsg({ type: 'ok', text: `保存しました（${data.id} / 全${data.total}問）。続けて次の問題を入力できます。` })
      setTotal(data.total)
      // 設問はリセット、盤面もリセット（連続入力しやすく）
      setTitle(''); setQuestion(''); setExplanation('')
      setChoices([{ key: 'A', label: '' }, { key: 'B', label: '' }, { key: 'C', label: '' }, { key: 'D', label: '' }])
      setAnswer(''); clearAll()
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const zoneChips = (tiles: string[], onPop: () => void) => (
    <div style={S.chips}>
      {tiles.length === 0 && <span style={S.empty}>（未入力）</span>}
      {tiles.map((t, i) => <span key={i} style={S.chip}>{t}</span>)}
      {tiles.length > 0 && <button type="button" onClick={onPop} style={S.undo}>← 1つ戻す</button>}
    </div>
  )

  const isActive = (t: Target) =>
    t.kind === target.kind && (t.kind !== 'discard' || (target.kind === 'discard' && t.seat === target.seat))

  return (
    <main style={S.page}>
      <h1 style={S.h1}>🀄 麻雀 問題ビルダー</h1>
      <p style={S.lead}>
        自分の手牌と各家の捨て牌、設問を入力して問題を追加します。追加先は問題集アプリ（現在 {total} 問）。
        入力後の反映（TestFlight）は別途ビルドで行います。
      </p>

      {/* 入力先タブ */}
      <div style={S.tabs}>
        <button type="button" onClick={() => setTarget({ kind: 'hand' })} style={{ ...S.tab, ...(isActive({ kind: 'hand' }) ? S.tabOn : {}) }}>自分の手牌 ({hand.length})</button>
        {SEAT_ORDER.map((s) => (
          <button key={s} type="button" onClick={() => setTarget({ kind: 'discard', seat: s })}
            style={{ ...S.tab, ...(isActive({ kind: 'discard', seat: s }) ? S.tabOn : {}) }}>
            {SEAT_LABEL[s]}の河 ({discards[s].length})
          </button>
        ))}
        <button type="button" onClick={() => setTarget({ kind: 'dora' })} style={{ ...S.tab, ...(isActive({ kind: 'dora' }) ? S.tabOn : {}) }}>ドラ ({dora.length})</button>
      </div>

      {/* 牌キーボード */}
      <div style={S.keyboard}>
        {tileGroups.map((g) => (
          <div key={g.name} style={S.krow}>
            {g.tiles.map((t) => (
              <button key={t} type="button" onClick={() => addTile(t)} style={S.key}>{t}</button>
            ))}
          </div>
        ))}
      </div>

      {/* 現在の入力内容 */}
      <div style={S.zones}>
        <div style={S.zone}><span style={S.zoneLabel}>自分の手牌</span>{zoneChips(hand, popHand)}</div>
        {SEAT_ORDER.map((s) => (
          <div key={s} style={S.zone}><span style={S.zoneLabel}>{SEAT_LABEL[s]}の河</span>{zoneChips(discards[s], () => popDiscard(s))}</div>
        ))}
        <div style={S.zone}><span style={S.zoneLabel}>ドラ表示牌</span>{zoneChips(dora, popDora)}</div>
      </div>

      {/* 設問 */}
      <div style={S.form}>
        <label style={S.field}><span style={S.flabel}>タイトル</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={S.input} placeholder="例: 3副露の対面に何を切るか" /></label>
        <label style={S.field}><span style={S.flabel}>問題文</span>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} style={S.textarea} rows={2} placeholder="例: 対面の仕掛けを読んだ上で何を切るべきでしょうか？" /></label>

        <div style={S.field}><span style={S.flabel}>選択肢（2つ以上）と正解</span>
          {choices.map((c, i) => (
            <div key={c.key} style={S.choiceRow}>
              <button type="button" onClick={() => setAnswer(c.key)}
                style={{ ...S.answerBtn, ...(answer === c.key ? S.answerOn : {}) }} title="正解に設定">{answer === c.key ? '● 正解' : c.key}</button>
              <input value={c.label} onChange={(e) => setChoices((cs) => cs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                style={S.input} placeholder={`選択肢${c.key}（例: 打 西 / 8筒 など）`} />
            </div>
          ))}
        </div>

        <label style={S.field}><span style={S.flabel}>解説</span>
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} style={S.textarea} rows={3} placeholder="正解の理由・読みの根拠" /></label>

        <div style={S.grid2}>
          <label style={S.field}><span style={S.flabel}>難易度</span>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')} style={S.input}>
              <option value="easy">易</option><option value="medium">普通</option><option value="hard">難</option>
            </select></label>
          <label style={S.field}><span style={S.flabel}>タグ（カンマ区切り）</span>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} style={S.input} placeholder="鳴き読み, 副露読み" /></label>
          <label style={S.field}><span style={S.flabel}>場風</span>
            <select value={bakaze} onChange={(e) => setBakaze(e.target.value)} style={S.input}>
              <option>東</option><option>南</option></select></label>
          <label style={S.field}><span style={S.flabel}>局</span>
            <input type="number" min={1} max={4} value={kyoku} onChange={(e) => setKyoku(Number(e.target.value))} style={S.input} /></label>
        </div>
      </div>

      {msg && <p style={msg.type === 'ok' ? S.ok : S.err}>{msg.text}</p>}

      <div style={S.actions}>
        <button type="button" onClick={clearAll} style={S.clear}>盤面クリア</button>
        <button type="button" onClick={save} disabled={saving} style={S.save}>{saving ? '保存中…' : 'この問題を追加'}</button>
      </div>
      <div style={{ height: 40 }} />
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 720, margin: '0 auto', padding: '16px 14px 40px', fontFamily: 'system-ui, sans-serif', color: '#111' },
  h1: { fontSize: 20, margin: '4px 0 8px' },
  lead: { fontSize: 13, lineHeight: 1.6, color: '#444', margin: '0 0 14px' },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tab: { fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' },
  tabOn: { borderColor: '#4f46e5', background: '#eef2ff', fontWeight: 700, color: '#3730a3' },
  keyboard: { background: '#065f46', borderRadius: 12, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 },
  krow: { display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  key: { minWidth: 40, height: 40, fontSize: 15, fontWeight: 700, borderRadius: 6, border: '1px solid #d6cfb8', background: '#f7f4ea', color: '#1b2431', cursor: 'pointer' },
  zones: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  zone: { border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 8px', background: '#fff' },
  zoneLabel: { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  chip: { fontSize: 14, padding: '3px 7px', borderRadius: 5, background: '#f1f5f9', border: '1px solid #cbd5e1' },
  empty: { fontSize: 12, color: '#9ca3af' },
  undo: { fontSize: 11, marginLeft: 4, padding: '2px 8px', borderRadius: 5, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#334155' },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  field: { display: 'flex', flexDirection: 'column', gap: 3 },
  flabel: { fontSize: 12, fontWeight: 600, color: '#374151' },
  input: { padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' },
  textarea: { padding: 9, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' },
  choiceRow: { display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 },
  answerBtn: { minWidth: 54, height: 38, fontSize: 12, borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', flexShrink: 0 },
  answerOn: { borderColor: '#16a34a', background: '#dcfce7', color: '#166534', fontWeight: 700 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  actions: { display: 'flex', gap: 10, marginTop: 16 },
  clear: { flex: '0 0 auto', padding: '14px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: 14 },
  save: { flex: 1, padding: 14, borderRadius: 10, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' },
  ok: { color: '#166534', fontSize: 14, background: '#dcfce7', padding: '8px 10px', borderRadius: 8 },
  err: { color: '#b91c1c', fontSize: 14, background: '#fee2e2', padding: '8px 10px', borderRadius: 8 },
}
