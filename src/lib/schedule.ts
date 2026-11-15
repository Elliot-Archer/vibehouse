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

// The waste task is not part of the rotation; it defaults each week to whoever
// has the "Bakken" huistaak, but can be swapped like any other task.
export const WASTE_TASK_NAME = 'Vuilnis'
export const WASTE_OWNER_HUISTAAK = 'bakken'

// The person responsible for putting the containers out by default: the user
// whose huistaak mentions "Bakken". Falls back to ELLIOT_USER_ID if nobody does.
export async function getWasteDefaultUserId(
  supabaseClient: SupabaseClient
): Promise<string | null> {
  const { data } = await supabaseClient
    .from('users')
    .select('id')
    .ilike('huistaak', `%${WASTE_OWNER_HUISTAAK}%`)
    .order('name')
    .limit(1)
  return data?.[0]?.id ?? process.env.ELLIOT_USER_ID ?? null
}

// Look up the waste task id by name.
export async function getWasteTaskId(
  supabaseClient: SupabaseClient
): Promise<string | null> {
  const { data } = await supabaseClient
    .from('tasks')
    .select('id')
    .eq('name', WASTE_TASK_NAME)
    .single()
  return data?.id ?? null
}

// Ensure a waste schedule entry exists for the week, defaulting to the given
// user. Existing entries (e.g. already swapped to someone else) are preserved.
export async function ensureWasteEntry(
  supabaseClient: SupabaseClient,
  monday: Date,
  defaultUserId: string
): Promise<void> {
  const taskId = await getWasteTaskId(supabaseClient)
  if (!taskId) return

  const { error } = await supabaseClient.from('schedule_entries').upsert(
    [
      {
        task_id: taskId,
        user_id: defaultUserId,
        week: formatWeekDate(monday),
        status: 'pending',
      },
    ],
    { onConflict: 'task_id,week', ignoreDuplicates: true }
  )
  if (error) throw error
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

export interface ShiftChange {
  taskId: string
  week: string
  oldUserId: string
  newUserId: string
}

// Shifts the schedule of one task by one week, starting at startMonday.
//  - 'later'   (week naar achter): whoever had week W now has week W+1.
//  - 'earlier' (week naar voren):  whoever had week W+1 now has week W.
// Existing entries (including swaps) are the source of truth; weeks without an
// entry fall back to the normal rotation. Weeks marked 'done' are left alone.
// Returns the weeks whose assignee actually changed.
export async function shiftTaskSchedule(
  supabaseClient: SupabaseClient,
  taskId: string,
  startMonday: Date,
  direction: 'earlier' | 'later',
  weeksAhead = 52
): Promise<ShiftChange[]> {
  const { data: members, error: membersError } = await supabaseClient
    .from('task_members')
    .select('task_id, user_id, order')
    .eq('task_id', taskId)

  if (membersError) throw membersError
  if (!members || members.length === 0) return []

  // Weeks -1 .. weeksAhead relative to startMonday (one extra on each side so
  // the edges have a neighbour to shift from).
  const weekDates: Date[] = []
  for (let i = -1; i <= weeksAhead; i++) {
    const d = new Date(startMonday)
    d.setDate(startMonday.getDate() + i * 7)
    weekDates.push(d)
  }
  const weekStrs = weekDates.map(formatWeekDate)

  const { data: existing, error: existingError } = await supabaseClient
    .from('schedule_entries')
    .select('id, user_id, week, status')
    .eq('task_id', taskId)
    .gte('week', weekStrs[0])
    .lte('week', weekStrs[weekStrs.length - 1])

  if (existingError) throw existingError

  const byWeek = new Map<string, { id: string; user_id: string; status: string }>()
  for (const e of existing || []) byWeek.set(e.week, e)

  const currentUser = (idx: number) =>
    byWeek.get(weekStrs[idx])?.user_id ??
    getAssignedUserId(members as TaskMember[], weekDates[idx])

  const entries = []
  const changes: ShiftChange[] = []
  // idx 1 .. weeksAhead correspond to startMonday .. startMonday + weeksAhead-1
  for (let idx = 1; idx <= weeksAhead; idx++) {
    const week = weekStrs[idx]
    const current = byWeek.get(week)
    if (current?.status === 'done') continue

    const newUserId = currentUser(direction === 'later' ? idx - 1 : idx + 1)
    const oldUserId = currentUser(idx)
    if (oldUserId === newUserId) continue

    entries.push({
      task_id: taskId,
      user_id: newUserId,
      week,
      status: current?.status ?? 'pending',
    })
    changes.push({ taskId, week, oldUserId, newUserId })
  }

  if (entries.length === 0) return []

  const { error: upsertError } = await supabaseClient
    .from('schedule_entries')
    .upsert(entries, { onConflict: 'task_id,week', ignoreDuplicates: false })

  if (upsertError) throw upsertError

  // Open swap requests on entries that changed hands no longer make sense
  // (accepting one would hand over somebody else's task), so decline them.
  const changedEntryIds = changes
    .map((c) => byWeek.get(c.week)?.id)
    .filter((id): id is string => Boolean(id))
  if (changedEntryIds.length > 0) {
    await supabaseClient
      .from('swap_requests')
      .update({ status: 'declined' })
      .in('entry_id', changedEntryIds)
      .eq('status', 'pending')
  }

  return changes
}
