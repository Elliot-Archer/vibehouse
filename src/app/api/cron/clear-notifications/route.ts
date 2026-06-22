import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { getCurrentMonday } from '@/lib/schedule'

// Weekly cleanup: wipes notifications from before the current week so the
// notification center only ever shows the running week. Scheduled just before
// the Monday weekly-reminder cron so this week's reminders survive.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 401 })
  }

  const cutoff = getCurrentMonday().toISOString()
  const supabase = createSupabaseServiceClient()

  const { error, count } = await supabase
    .from('notifications')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0, cutoff })
}
