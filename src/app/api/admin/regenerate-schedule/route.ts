import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import {
  getCurrentMonday,
  reassignTaskFromWeek,
  upsertWeekSchedule,
} from '@/lib/schedule'

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  let body: { taskId?: string; effectiveFrom?: 'this-week' | 'next-week' } = {}
  try {
    body = await request.json()
  } catch {
    // Backward compatible: allow empty body.
  }

  const currentMonday = getCurrentMonday()
  const effectiveMonday = new Date(currentMonday)
  if (body.effectiveFrom === 'next-week') {
    effectiveMonday.setDate(effectiveMonday.getDate() + 7)
  }

  const supabase = createSupabaseServiceClient()
  try {
    if (body.taskId) {
      await reassignTaskFromWeek(supabase, body.taskId, effectiveMonday)
    } else {
      await upsertWeekSchedule(supabase, currentMonday)
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Fout bij genereren schema', detail: String(err) },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
