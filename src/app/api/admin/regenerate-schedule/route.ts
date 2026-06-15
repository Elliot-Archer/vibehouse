import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { getCurrentMonday, upsertWeekSchedule } from '@/lib/schedule'

export async function POST() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const supabase = createSupabaseServiceClient()
  try {
    await upsertWeekSchedule(supabase, getCurrentMonday())
  } catch (err) {
    return NextResponse.json(
      { error: 'Fout bij genereren schema', detail: String(err) },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true })
}
