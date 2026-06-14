import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { addPromptQueueItem, buildPromptQueueView } from '@/lib/prompt-queue'
import type { PromptQueueInput } from '@/types/prompt-queue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function revalidatePromptQueue() {
  try {
    revalidatePath('/prompt-queue')
  } catch (err) {
    console.warn('Failed to revalidate prompt queue:', err)
  }
}

export async function GET() {
  try {
    return NextResponse.json(await buildPromptQueueView())
  } catch (err) {
    console.error('Failed to read prompt queue:', err)
    return NextResponse.json({ error: 'failed to read prompt queue' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let body: PromptQueueInput
  try {
    body = await request.json() as PromptQueueInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  try {
    const item = await addPromptQueueItem({ ...body, source: 'manual' })
    revalidatePromptQueue()
    return NextResponse.json({ success: true, item })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'invalid prompt queue item' }, { status: 400 })
  }
}
