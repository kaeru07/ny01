'use client'

import { useEffect, useState } from 'react'
import type { ConfirmItem, ConfirmAnswer } from '@/lib/mahjong-confirm'

// 【一時ページ】麻雀問題（手牌読みドリル由来）の未確定箇所を確定する。
// 取り込みが終わったらページごと削除してよい。

type Selection = { value: string; freeText: string }

const OTHER = '__other__'

export default function MahjongConfirmPage() {
  const [items, setItems] = useState<ConfirmItem[]>([])
  const [sel, setSel] = useState<Record<string, Selection>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/mahjong-confirm', { cache: 'no-store' })
        if (!res.ok) throw new Error(`読み込みに失敗しました (${res.status})`)
        const data = (await res.json()) as { items: ConfirmItem[]; answers: ConfirmAnswer[]; updatedAt: string }
        setItems(data.items ?? [])
        const initial: Record<string, Selection> = {}
        for (const a of data.answers ?? []) {
          initial[a.itemId] = { value: a.value, freeText: a.freeText ?? '' }
        }
        setSel(initial)
        setSavedAt(data.updatedAt ?? '')
      } catch (err) {
        setError(err instanceof Error ? err.message : '読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function pick(itemId: string, value: string) {
    setSel((prev) => ({ ...prev, [itemId]: { value, freeText: prev[itemId]?.freeText ?? '' } }))
  }

  function setFreeText(itemId: string, text: string) {
    setSel((prev) => ({ ...prev, [itemId]: { value: prev[itemId]?.value ?? OTHER, freeText: text } }))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const answers = Object.entries(sel)
        .filter(([, s]) => s.value)
        .map(([itemId, s]) => ({
          itemId,
          value: s.value === OTHER ? (s.freeText.trim() ? OTHER : '') : s.value,
          freeText: s.freeText,
        }))
        .filter((a) => a.value)
      const res = await fetch('/api/mahjong-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) throw new Error(`保存に失敗しました (${res.status})`)
      const data = (await res.json()) as { updatedAt: string }
      setSavedAt(data.updatedAt)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const answered = items.filter((i) => sel[i.id]?.value).length

  if (loading) return <main style={S.page}><p style={S.muted}>読み込み中…</p></main>

  return (
    <main style={S.page}>
      <p style={S.badge}>一時ページ（確定したら削除します）</p>
      <h1 style={S.h1}>麻雀の問題 確定シート</h1>
      <p style={S.lead}>
        本の写真から読み取りきれなかった箇所です。正しいものを選んで保存してください。
        保存後に「確定シート反映して」と伝えてもらえれば questions.json に反映します。
      </p>
      <p style={S.progress}>{answered} / {items.length} 件 選択済み{savedAt ? ` ・ 最終保存 ${new Date(savedAt).toLocaleString('ja-JP')}` : ''}</p>

      {items.map((item) => {
        const cur = sel[item.id]
        return (
          <section key={item.id} style={S.card}>
            <p style={S.qid}>{item.questionId}</p>
            <p style={S.title}>{item.questionTitle}</p>
            <p style={S.ask}>{item.ask}</p>
            <p style={S.impact}>{item.impact}</p>

            <div style={S.options}>
              {item.options.map((opt) => {
                const active = cur?.value === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => pick(item.id, opt.value)}
                    style={{ ...S.option, ...(active ? S.optionActive : {}) }}
                  >
                    <span style={S.optionLabel}>{opt.label}</span>
                    {opt.hint && <span style={S.optionHint}>{opt.hint}</span>}
                  </button>
                )
              })}

              {item.allowFreeText && (
                <button
                  type="button"
                  onClick={() => pick(item.id, OTHER)}
                  style={{ ...S.option, ...(cur?.value === OTHER ? S.optionActive : {}) }}
                >
                  <span style={S.optionLabel}>その他（自分で書く）</span>
                </button>
              )}
            </div>

            {item.allowFreeText && (
              <textarea
                value={cur?.freeText ?? ''}
                onChange={(e) => setFreeText(item.id, e.target.value)}
                placeholder="正しい内容・補足があれば書いてください"
                style={S.textarea}
                rows={2}
              />
            )}
          </section>
        )
      })}

      {error && <p style={S.error}>{error}</p>}

      <button type="button" onClick={save} disabled={saving} style={S.save}>
        {saving ? '保存中…' : '保存する'}
      </button>
      <div style={{ height: 48 }} />
    </main>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 680, margin: '0 auto', padding: '16px 16px 32px', fontFamily: 'system-ui, sans-serif' },
  badge: { display: 'inline-block', fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 999, margin: 0 },
  h1: { fontSize: 22, margin: '12px 0 8px' },
  lead: { fontSize: 14, lineHeight: 1.7, color: '#374151', margin: '0 0 12px' },
  progress: { fontSize: 13, color: '#6b7280', margin: '0 0 20px' },
  muted: { color: '#6b7280' },
  card: { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 16, background: '#fff' },
  qid: { fontSize: 12, color: '#6b7280', margin: 0, fontFamily: 'ui-monospace, monospace' },
  title: { fontSize: 15, fontWeight: 700, margin: '4px 0 10px', lineHeight: 1.5 },
  ask: { fontSize: 15, margin: '0 0 6px', lineHeight: 1.6 },
  impact: { fontSize: 13, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.6 },
  options: { display: 'flex', flexDirection: 'column', gap: 8 },
  option: { textAlign: 'left', border: '1px solid #d1d5db', borderRadius: 10, padding: '12px 14px', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 15 },
  optionActive: { borderColor: '#4f46e5', background: '#eef2ff', boxShadow: 'inset 0 0 0 1px #4f46e5' },
  optionLabel: { fontWeight: 600 },
  optionHint: { fontSize: 12, color: '#6b7280' },
  textarea: { width: '100%', marginTop: 10, padding: 10, borderRadius: 8, border: '1px solid #d1d5db', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' },
  save: { width: '100%', padding: '16px', fontSize: 16, fontWeight: 700, color: '#fff', background: '#4f46e5', border: 'none', borderRadius: 12, cursor: 'pointer' },
  error: { color: '#b91c1c', fontSize: 14 },
}
