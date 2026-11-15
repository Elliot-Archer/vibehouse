import { NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/auth'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import {
  formatWeekDate,
  getCurrentMonday,
  shiftTaskSchedule,
  type ShiftChange,
} from '@/lib/schedule'
import { createNotifications } from '@/lib/notifications'
import { sendPushToUser } from '@/lib/push'

// Shifts the rotation of one task (or all tasks) one week earlier or later and
// notifies everyone who ends up with a different task in the first affected week.
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  let body: {
    taskId?: string | null
    direction?: 'earlier' | 'later'
    effectiveFrom?: 'this-week' | 'next-week'
  } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 })
  }

  if (body.direction !== 'earlier' && body.direction !== 'later') {
    return NextResponse.json({ error: 'Ongeldige richting' }, { status: 400 })
  }

  const startMonday = getCurrentMonday()
  if (body.effectiveFrom === 'next-week') {
    startMonday.setDate(startMonday.getDate() + 7)
  }
  const startWeek = formatWeekDate(startMonday)

  const supabase = createSupabaseServiceClient()

  let taskIds: string[]
  if (body.taskId) {
    taskIds = [body.taskId]
  } else {
    const { data: members, error } = await supabase
      .from('task_members')
      .select('task_id')
    if (error) {
      return NextResponse.json({ error: 'Fout bij ophalen taken' }, { status: 500 })
    }
    taskIds = [...new Set((members || []).map((m) => m.task_id as string))]
  }

  const changes: ShiftChange[] = []
  try {
    for (const taskId of taskIds) {
      changes.push(
        ...(await shiftTaskSchedule(supabase, taskId, startMonday, body.direction))
      )
    }
  } catch (err) {
    return NextResponse.json(
      { error: 'Fout bij verschuiven schema', detail: String(err) },
      { status: 500 }
    )
  }

  // Notify only about the first affected week: that is the task people need
  // to act on now; later weeks follow automatically.
  const firstWeekChanges = changes.filter((c) => c.week === startWeek)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, name')
    .in('id', [...new Set(firstWeekChanges.map((c) => c.taskId))])
  const taskName = new Map((tasks || []).map((t) => [t.id as string, t.name as string]))

  const tasksByUser = new Map<string, string[]>()
  for (const c of firstWeekChanges) {
    const list = tasksByUser.get(c.newUserId) ?? []
    list.push(taskName.get(c.taskId) ?? 'een taak')
    tasksByUser.set(c.newUserId, list)
  }

  const when = body.effectiveFrom === 'next-week' ? 'volgende week' : 'deze week'
  const pushes = [...tasksByUser.entries()].map(async ([userId, names]) => {
    const list = names.map((n) => `"${n}"`).join(' en ')
    const text = `Het rooster is verschoven: ${when} heb jij ${list}`
    await createNotifications(supabase, [
      {
        userId,
        direction: 'incoming',
        type: 'schedule_shift',
        actorId: null,
        body: text,
        url: '/schema',
      },
    ])
    return sendPushToUser(supabase, userId, {
      title: 'Tjokkellust',
      body: text,
      url: '/schema',
    })
  })
  await Promise.allSettled(pushes)

  return NextResponse.json({
    success: true,
    changedWeeks: changes.length,
    notified: tasksByUser.size,
  })
}
