import { NextResponse } from 'next/server'
import { readAppUrls, writeAppUrls, applyAppUrlEdit } from '@/lib/app-urls'
import type { AppUrlRecord, AppUrlStatus } from '@/lib/app-urls'

export const dynamic = 'force-dynamic'

interface PatchBody {
  urls?: Partial<AppUrlRecord>[]
  name?: string
  purpose?: string
  status?: AppUrlStatus
  notes?: string
}

// ユーザーが画面から URL（および任意のアプリ属性）を編集して保存する。
export async function PATCH(
  request: Request,
  { params }: { params: { appId: string } },
) {
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  if (body.urls !== undefined && !Array.isArray(body.urls)) {
    return NextResponse.json({ error: 'urls must be an array' }, { status: 400 })
  }

  const registry = await readAppUrls()
  const updated = applyAppUrlEdit(registry, params.appId, {
    urls: body.urls,
    name: body.name,
    purpose: body.purpose,
    status: body.status,
    notes: body.notes,
  })

  if (!updated) {
    return NextResponse.json({ error: `app not found: ${params.appId}` }, { status: 404 })
  }

  await writeAppUrls(updated)
  const app = updated.apps.find((a) => a.id === params.appId)
  return NextResponse.json({ success: true, app })
}
