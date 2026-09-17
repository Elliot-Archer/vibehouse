import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'
import { createNotifications } from '@/lib/notifications'
import { getTodayWastePickups, getWastePickupsInWeek, getWasteTypeLabel } from '@/lib/waste'
import {
  ensureWasteEntry,
  formatWeekDate,
  getMonday,
  getWasteDefaultUserId,
  upsertWeekSchedule,
  WASTE_TASK_NAME,
} from '@/lib/schedule'
import type { ScheduleEntry, Task } from '@/types'

// Runs every hour. On a task's "reminder day" it nags whoever holds that task
// at 9:00, 12:00, 15:00 and then every hour until 22:00 — but only while the
// entry is not yet marked "Klaar".
const FIRST_HOUR = 9
const FIXED_HOURS = [9, 12, 15]
const HOURLY_FROM = 16
const LAST_HOUR = 22

// Reminder day per weekly task (0 = zondag, 1 = maandag, 2 = dinsdag, …).
// The waste task has no fixed weekday: it is reminded on each pickup day.
// Tasks not listed here only get the regular Monday reminder.
const TASK_REMINDER_DAY: { match: (name: string) => boolean; day: number }[] = [
  { match: (n) => n === 'keuken', day: 0 },
  { match: (n) => n === 'bazaar', day: 2 },
  { match: (n) => n.startsWith('middenverdiep'), day: 2 }, // DB spelling: "Middenverdiepeing"
  { match: (n) => n === 'skylounge', day: 2 },
  { match: (n) => n === 'fusie', day: 2 },
]

function amsterdamParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    weekday: weekdays.indexOf(get('weekday')),
  }
}

type Reminder = {
  userId: string
  kind: 'waste_reminder' | 'weekly_reminder'
  first: { title: string; body: string; notification: string }
  repeat: { title: string; body: string }
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
  const { date: today, hour, weekday } = amsterdamParts(now)
  const isReminderHour =
    FIXED_HOURS.includes(hour) || (hour >= HOURLY_FROM && hour <= LAST_HOUR)
  if (!isReminderHour) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'geen herinneringsuur' })
  }

  const supabase = createSupabaseServiceClient()
  const monday = getMonday(new Date(`${today}T12:00:00Z`))
  const week = formatWeekDate(monday)
  const isFirst = hour === FIRST_HOUR
  const reminders: Reminder[] = []

  const { data: tasks } = await supabase.from('tasks').select('*')
  const allTasks = (tasks || []) as Task[]

  // --- Containers: on the pickup day itself --------------------------------
  const wasteTask = allTasks.find((t) => t.name === WASTE_TASK_NAME)
  const pickups = getTodayWastePickups(now)
  if (wasteTask && pickups.length > 0) {
    const defaultUserId = await getWasteDefaultUserId(supabase)
    if (defaultUserId) await ensureWasteEntry(supabase, monday, defaultUserId)

    const { data: entry } = await supabase
      .from('schedule_entries')
      .select('id, user_id, status')
      .eq('task_id', wasteTask.id)
      .eq('week', week)
      .single()

    if (entry) {
      // One entry covers the whole week, but some weeks have two pickups
      // (papier on Tuesday, GFT on Wednesday). Each pickup needs its own
      // "Klaar", so at the first reminder of a later pickup we reopen it.
      let status = entry.status
      const hadEarlierPickup = getWastePickupsInWeek(monday).some((p) => p.datum < today)
      if (isFirst && status === 'done' && hadEarlierPickup) {
        await supabase.from('schedule_entries').update({ status: 'pending' }).eq('id', entry.id)
        status = 'pending'
      }
      if (status !== 'done') {
        const types = [...new Set(pickups.map((p) => getWasteTypeLabel(p.type)))].join(', ')
        reminders.push({
          userId: entry.user_id,
          kind: 'waste_reminder',
          first: {
            title: 'Vuilnis vandaag',
            body: `Vandaag wordt opgehaald: ${types}. Zet de container buiten en tik op Klaar.`,
            notification: `Vuilnis: vandaag wordt opgehaald: ${types}`,
          },
          repeat: {
            title: 'Vuilnis nog niet klaar',
            body: `${types} wordt vandaag opgehaald. Staat de container buiten? Tik op Klaar.`,
          },
        })
      }
    }
  }

  // --- Weekly chores: on their own reminder day ----------------------------
  const dueTasks = allTasks.filter((t) =>
    TASK_REMINDER_DAY.some((r) => r.day === weekday && r.match(t.name.toLowerCase()))
  )
  if (dueTasks.length > 0) {
    // Make sure this week's entries exist even if nobody opened the app yet.
    await upsertWeekSchedule(supabase, monday)
    const { data: entries } = await supabase
      .from('schedule_entries')
      .select('*')
      .eq('week', week)
      .in('task_id', dueTasks.map((t) => t.id))

    for (const entry of (entries || []) as ScheduleEntry[]) {
      if (entry.status === 'done') continue
      const task = dueTasks.find((t) => t.id === entry.task_id)
      if (!task) continue
      reminders.push({
        userId: entry.user_id,
        kind: 'weekly_reminder',
        first: {
          title: `Poetsdag: ${task.name}`,
          body: `Vandaag moet ${task.name} af. Tik op Klaar als het gedaan is.`,
          notification: `Herinnering: vandaag moet "${task.name}" af`,
        },
        repeat: {
          title: 'POETSEN FEUT!',
          body: `${task.name} staat nog niet op Klaar.`,
        },
      })
    }
  }

  // --- Send -----------------------------------------------------------------
  const results = await Promise.allSettled(
    reminders.map(async (r) => {
      // In-app melding alleen bij de eerste herinnering, anders loopt /meldingen vol.
      if (isFirst) {
        await createNotifications(supabase, [
          {
            userId: r.userId,
            direction: 'incoming',
            type: r.kind,
            actorId: null,
            body: r.first.notification,
            url: '/schema',
          },
        ])
      }
      const msg = isFirst ? r.first : r.repeat
      await sendPushToUser(supabase, r.userId, { title: msg.title, body: msg.body, url: '/schema' })
    })
  )

  return NextResponse.json({
    ok: true,
    hour,
    weekday,
    week,
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  })
}
