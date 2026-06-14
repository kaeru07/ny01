import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { archivePromptQueueItem, updatePromptQueueItem } from '@/lib/prompt-queue'
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

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: PromptQueueInput
  try {
    body = await request.json() as PromptQueueInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const item = await updatePromptQueueItem(params.id, body)
  if (!item) return NextResponse.json({ error: `prompt queue item not found: ${params.id}` }, { status: 404 })
  revalidatePromptQueue()
  return NextResponse.json({ success: true, item })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const item = await archivePromptQueueItem(params.id)
  if (!item) return NextResponse.json({ error: `prompt queue item not found: ${params.id}` }, { status: 404 })
  revalidatePromptQueue()
  return NextResponse.json({ success: true, item })
}
