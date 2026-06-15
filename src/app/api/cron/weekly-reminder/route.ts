import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { getCurrentMonday, upsertWeekSchedule, formatWeekDate } from '@/lib/schedule'
import { sendPushToUser } from '@/lib/push'
import type { ScheduleEntry, Task } from '@/types'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 401 })
  }

  const supabase = createSupabaseServiceClient()
  const monday = getCurrentMonday()

  try {
    await upsertWeekSchedule(supabase, monday)
  } catch (err) {
    return NextResponse.json(
      { error: 'Fout bij genereren schema', detail: String(err) },
      { status: 500 }
    )
  }

  const weekStr = formatWeekDate(monday)

  const { data: entries } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('week', weekStr)

  if (!entries || entries.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const taskIds = [...new Set((entries as ScheduleEntry[]).map((e) => e.task_id))]
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('id', taskIds)

  const taskMap = new Map<string, Task>(
    (tasks || []).map((t: Task) => [t.id, t])
  )

  const serviceSupabase = supabase
  const results = await Promise.allSettled(
    (entries as ScheduleEntry[]).map((entry) => {
      const task = taskMap.get(entry.task_id)
      if (!task) return Promise.reject(new Error('Task not found'))

      return sendPushToUser(serviceSupabase, entry.user_id, {
        title: 'Vibehouse',
        body: `Vergeet je taak niet: ${task.name}`,
        url: '/schema',
      })
    })
  )
  const sent = results.filter(r => r.status === 'fulfilled').length

  return NextResponse.json({ ok: true, sent })
}
