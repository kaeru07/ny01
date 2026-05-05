import { NextResponse } from 'next/server'
import { addNews, createId } from '@/lib/store'
import type { NewsCategory, NewsItem } from '@/types/sns'

const categories: NewsCategory[] = ['model', 'coding', 'product', 'research', 'business', 'security', 'other']

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const title = String(body.title ?? '').trim()
    const sourceUrl = String(body.sourceUrl ?? '').trim()
    const sourceName = String(body.sourceName ?? '').trim()
    const summary = String(body.summary ?? '').trim()
    const category = categories.includes(body.category) ? body.category : 'other'
    const importance = Math.min(5, Math.max(1, Number(body.importance ?? 3)))
    const memo = String(body.memo ?? '').trim()

    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
    if (!sourceUrl) return NextResponse.json({ error: 'sourceUrl is required' }, { status: 400 })
    if (!sourceName) return NextResponse.json({ error: 'sourceName is required' }, { status: 400 })
    if (!summary) return NextResponse.json({ error: 'summary is required' }, { status: 400 })

    const item: NewsItem = {
      id: createId('news'),
      title,
      sourceUrl,
      sourceName,
      summary,
      category,
      importance,
      memo,
      createdAt: new Date().toISOString(),
    }

    await addNews(item)
    return NextResponse.json({ success: true, item })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
