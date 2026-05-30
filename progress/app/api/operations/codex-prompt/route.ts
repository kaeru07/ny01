import { NextResponse } from 'next/server'
import { generateCodexPrompt } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const epicId = new URL(request.url).searchParams.get('epicId') ?? undefined
  const prompt = await generateCodexPrompt(epicId)
  return NextResponse.json(prompt)
}
