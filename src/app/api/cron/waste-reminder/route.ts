import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'
import { createNotifications } from '@/lib/notifications'
import { getTomorrowWastePickups, getWastePickupsInWeek, getWasteTypeLabel } from '@/lib/waste'
import {
  ensureWasteEntry,
  formatWeekDate,
  getMonday,
  getWasteDefaultUserId,
  getWasteTaskId,
} from '@/lib/schedule'

// Runs every hour. On the day before a pickup it nags whoever holds the waste
// entry at 9:00, 12:00, 15:00 and then every hour until 22:00 — but only while
// the entry is not yet marked "Klaar".
const FIRST_HOUR = 9
const FIXED_HOURS = [9, 12, 15]
const HOURLY_FROM = 16
const LAST_HOUR = 22

function amsterdamHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  )
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 401 })
  }

  const now = new Date()
  const hour = amsterdamHour(now)
  const isReminderHour =
    FIXED_HOURS.includes(hour) || (hour >= HOURLY_FROM && hour <= LAST_HOUR)
  if (!isReminderHour) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'geen herinneringsuur' })
  }

  const pickups = getTomorrowWastePickups(now)
  if (pickups.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'morgen geen ophaaldag' })
  }

  const supabase = createSupabaseServiceClient()
  const wasteTaskId = await getWasteTaskId(supabase)
  if (!wasteTaskId) {
    return NextResponse.json({ error: 'Vuilnistaak niet gevonden' }, { status: 500 })
  }

  const pickupDate = pickups[0].datum
  const monday = getMonday(new Date(`${pickupDate}T12:00:00Z`))
  const week = formatWeekDate(monday)

  // Make sure the week has a responsible person, even if nobody opened the app.
  const defaultUserId = await getWasteDefaultUserId(supabase)
  if (defaultUserId) await ensureWasteEntry(supabase, monday, defaultUserId)

  const { data: entry } = await supabase
    .from('schedule_entries')
    .select('id, user_id, status')
    .eq('task_id', wasteTaskId)
    .eq('week', week)
    .single()
  if (!entry) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'geen verantwoordelijke' })
  }

  // One entry covers the whole week, but some weeks have two pickups (e.g.
  // papier on Tuesday, GFT on Wednesday). Each pickup needs its own "Klaar",
  // so at the first reminder for a later pickup we reopen the entry.
  const hadEarlierPickupThisWeek = getWastePickupsInWeek(monday).some(
    (p) => p.datum < pickupDate
  )
  let status = entry.status
  if (hour === FIRST_HOUR && status === 'done' && hadEarlierPickupThisWeek) {
    await supabase.from('schedule_entries').update({ status: 'pending' }).eq('id', entry.id)
    status = 'pending'
  }

  if (status === 'done') {
    return NextResponse.json({ ok: true, sent: 0, reason: 'al op klaar' })
  }

  const types = [...new Set(pickups.map((p) => getWasteTypeLabel(p.type)))].join(', ')
  const isFirst = hour === FIRST_HOUR

  try {
    // In-app melding alleen bij de eerste herinnering, anders loopt /meldingen vol.
    if (isFirst) {
      await createNotifications(supabase, [
        {
          userId: entry.user_id,
          direction: 'incoming',
          type: 'waste_reminder',
          actorId: null,
          body: `Vuilnis: morgen wordt opgehaald: ${types}`,
          url: '/schema',
        },
      ])
    }
    await sendPushToUser(supabase, entry.user_id, {
      title: isFirst ? 'Vuilnis morgen' : 'Vuilnis nog niet klaar',
      body: isFirst
        ? `Morgen wordt opgehaald: ${types}. Zet de container klaar en tik op Klaar.`
        : `${types} wordt morgen opgehaald. Staat de container buiten? Tik op Klaar.`,
      url: '/schema',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, sent: 1, hour, week })
}
