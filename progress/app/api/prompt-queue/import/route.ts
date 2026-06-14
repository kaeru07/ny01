import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { importPromptQueueJson } from '@/lib/prompt-queue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const result = await importPromptQueueJson(body)
  try {
    revalidatePath('/prompt-queue')
  } catch (err) {
    console.warn('Failed to revalidate prompt queue:', err)
  }
  return NextResponse.json({ success: result.errors.length === 0, ...result }, { status: result.imported > 0 || result.errors.length === 0 ? 200 : 400 })
}
