import { NextResponse } from 'next/server'
import { runSkillMaintenance } from '@/lib/skill-maintenance'

export async function POST() {
  try {
    const result = await runSkillMaintenance()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
