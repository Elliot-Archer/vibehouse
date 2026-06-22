import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'
import { createNotifications } from '@/lib/notifications'
import { getTomorrowWastePickups, getWasteTypeLabel } from '@/lib/waste'
import { getMonday, formatWeekDate, getWasteTaskId } from '@/lib/schedule'

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

  // Send to whoever is responsible for waste this week (default Elliot).
  let responsibleUserId = elliotUserId
  try {
    const wasteTaskId = await getWasteTaskId(supabase)
    if (wasteTaskId) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const weekStr = formatWeekDate(getMonday(tomorrow))
      const { data: entry } = await supabase
        .from('schedule_entries')
        .select('user_id')
        .eq('task_id', wasteTaskId)
        .eq('week', weekStr)
        .single()
      if (entry?.user_id) responsibleUserId = entry.user_id
    }
  } catch (_) {
    // Fall back to Elliot.
  }

  try {
    await createNotifications(supabase, [
      {
        userId: responsibleUserId,
        direction: 'incoming',
        type: 'waste_reminder',
        actorId: null,
        body: `Vuilnis: morgen wordt opgehaald: ${uniqueTypes.join(', ')}`,
        url: '/schema',
      },
    ])
    await sendPushToUser(supabase, responsibleUserId, {
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
