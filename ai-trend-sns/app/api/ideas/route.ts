import { NextResponse } from 'next/server'
import { generateIdeas } from '@/lib/generator'
import { addIdeas, readNews } from '@/lib/store'

export async function POST() {
  try {
    const news = await readNews()
    const ideas = generateIdeas(news)
    await addIdeas(ideas)
    return NextResponse.json({ success: true, ideas })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
