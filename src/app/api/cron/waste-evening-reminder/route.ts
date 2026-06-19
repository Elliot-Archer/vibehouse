import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'
import { getTomorrowWastePickups, getWasteTypeLabel } from '@/lib/waste'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 401 })
  }

  const elliotUserId = process.env.ELLIOT_USER_ID
  if (!elliotUserId) {
    return NextResponse.json({ error: 'ELLIOT_USER_ID is not configured' }, { status: 500 })
  }

  const pickups = getTomorrowWastePickups(new Date())
  if (pickups.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const types = pickups.map((p) => getWasteTypeLabel(p.type))
  const uniqueTypes = [...new Set(types)]

  const supabase = createSupabaseServiceClient()

  try {
    await sendPushToUser(supabase, elliotUserId, {
      title: 'Vuilnis morgen',
      body: `Morgen wordt opgehaald: ${uniqueTypes.join(', ')}. Zet de container vanavond klaar.`,
      url: '/schema',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, sent: 1, count: pickups.length })
}
