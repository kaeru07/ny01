import { NextResponse } from 'next/server'
import { addPost, createId } from '@/lib/store'
import type { NewsCategory, Platform, PostLog } from '@/types/sns'

const platforms: Platform[] = ['x', 'youtube', 'note', 'blog', 'other']
const categories: NewsCategory[] = ['model', 'coding', 'product', 'research', 'business', 'security', 'other']

function toNumber(value: unknown): number {
  const num = Number(value ?? 0)
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const postedAtRaw = String(body.postedAt ?? '').trim()
    const content = String(body.content ?? '').trim()
    const platform = platforms.includes(body.platform) ? body.platform : 'other'
    const category = categories.includes(body.category) ? body.category : 'other'

    if (!postedAtRaw) return NextResponse.json({ error: 'postedAt is required' }, { status: 400 })
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

    const item: PostLog = {
      id: createId('post'),
      postedAt: new Date(postedAtRaw).toISOString(),
      platform,
      content,
      impressions: toNumber(body.impressions),
      likes: toNumber(body.likes),
      bookmarks: toNumber(body.bookmarks),
      replies: toNumber(body.replies),
      follows: toNumber(body.follows),
      category,
    }

    await addPost(item)
    return NextResponse.json({ success: true, item })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
