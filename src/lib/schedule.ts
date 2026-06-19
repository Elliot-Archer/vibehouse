import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskMember } from '@/types'

const EPOCH_MONDAY = new Date('1970-01-05T00:00:00Z')

export function getWeekIndex(monday: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.round((monday.getTime() - EPOCH_MONDAY.getTime()) / msPerWeek)
}

export function getCurrentMonday(): Date {
  return getMonday(new Date())
}

export function getMonday(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export function formatWeekDate(monday: Date): string {
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const d = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getAssignedUserId(
  members: TaskMember[],
  monday: Date
): string {
  const sorted = [...members].sort((a, b) => a.order - b.order)
  return sorted[getWeekIndex(monday) % sorted.length].user_id
}

export async function upsertWeekSchedule(
  supabaseClient: SupabaseClient,
  monday: Date
): Promise<void> {
  const weekStr = formatWeekDate(monday)

  // Fetch all tasks
  const { data: tasks, error: tasksError } = await supabaseClient
    .from('tasks')
    .select('id')

  if (tasksError) throw tasksError
  if (!tasks || tasks.length === 0) return

  // Fetch all task members
  const { data: members, error: membersError } = await supabaseClient
    .from('task_members')
    .select('task_id, user_id, order')

  if (membersError) throw membersError
  if (!members) return

  const entries = []
  for (const task of tasks) {
    const taskMembers = members.filter((m) => m.task_id === task.id)
    if (taskMembers.length === 0) continue

    const assignedUserId = getAssignedUserId(taskMembers, monday)
    entries.push({
      task_id: task.id,
      user_id: assignedUserId,
      week: weekStr,
      status: 'pending',
    })
  }

  if (entries.length === 0) return

  const { error: upsertError } = await supabaseClient
    .from('schedule_entries')
    .upsert(entries, {
      onConflict: 'task_id,week',
      ignoreDuplicates: true,
    })

  if (upsertError) throw upsertError
}

export async function reassignTaskFromWeek(
  supabaseClient: SupabaseClient,
  taskId: string,
  startMonday: Date,
  weeksAhead = 52
): Promise<void> {
  const { data: members, error: membersError } = await supabaseClient
    .from('task_members')
    .select('task_id, user_id, order')
    .eq('task_id', taskId)
    .order('order')

  if (membersError) throw membersError
  if (!members || members.length === 0) {
    throw new Error('Geen taakleden gevonden voor deze taak')
  }

  const endMonday = new Date(startMonday)
  endMonday.setDate(endMonday.getDate() + (weeksAhead - 1) * 7)

  const { data: existing, error: existingError } = await supabaseClient
    .from('schedule_entries')
    .select('task_id, week, status')
    .eq('task_id', taskId)
    .gte('week', formatWeekDate(startMonday))
    .lte('week', formatWeekDate(endMonday))

  if (existingError) throw existingError

  const existingByWeek = new Map<string, { status: 'pending' | 'done' }>()
  for (const entry of existing || []) {
    existingByWeek.set(entry.week, { status: entry.status as 'pending' | 'done' })
  }

  const entries = []
  for (let i = 0; i < weeksAhead; i++) {
    const weekDate = new Date(startMonday)
    weekDate.setDate(startMonday.getDate() + i * 7)
    const week = formatWeekDate(weekDate)

    const existingEntry = existingByWeek.get(week)
    if (existingEntry?.status === 'done') {
      // Behoud afgeronde taken zoals ze zijn.
      continue
    }

    entries.push({
      task_id: taskId,
      user_id: members[i % members.length].user_id,
      week,
      status: existingEntry?.status ?? 'pending',
    })
  }

  if (entries.length === 0) return

  const { error: upsertError } = await supabaseClient
    .from('schedule_entries')
    .upsert(entries, {
      onConflict: 'task_id,week',
      ignoreDuplicates: false,
    })

  if (upsertError) throw upsertError
}
