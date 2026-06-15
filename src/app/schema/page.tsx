import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCurrentMonday, formatWeekDate, getMonday } from '@/lib/schedule'
import { upsertWeekSchedule } from '@/lib/schedule'
import type { Task, User, ScheduleEntry, SwapRequest } from '@/types'
import MarkDoneButton from './MarkDoneButton'
import SwapButton from './SwapButton'
import SwapResponseButtons from './SwapResponseButtons'
import PushSubscriber from './PushSubscriber'
import { format, addDays } from 'date-fns'
import { nl } from 'date-fns/locale'

interface PageProps {
  searchParams: Promise<{ week?: string }>
}

export default async function SchemaPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('email', authUser.email)
    .single()

  if (!profile) redirect('/login')

  // Determine which week to show
  let monday: Date
  if (params.week) {
    const parsed = new Date(params.week + 'T00:00:00Z')
    monday = isNaN(parsed.getTime()) ? getCurrentMonday() : getMonday(parsed)
  } else {
    monday = getCurrentMonday()
  }

  const weekStr = formatWeekDate(monday)

  // Upsert schedule for this week (only for current/future weeks)
  const currentMonday = getCurrentMonday()
  if (monday.getTime() >= currentMonday.getTime()) {
    try {
      await upsertWeekSchedule(supabase, monday)
    } catch (_) {
      // Continue even if upsert fails
    }
  }

  // Fetch schedule entries for this week with task and user info
  const { data: entries } = await supabase
    .from('schedule_entries')
    .select('*')
    .eq('week', weekStr)

  // Fetch all tasks
  const { data: tasks } = await supabase.from('tasks').select('*')

  // Fetch all users
  const { data: users } = await supabase.from('users').select('*')

  // Fetch swap requests involving current user for this week's entries
  const entryIds = (entries || []).map((e) => e.id)
  const { data: swapRequests } = await supabase
    .from('swap_requests')
    .select('*')
    .in('entry_id', entryIds.length > 0 ? entryIds : ['none'])
    .eq('status', 'pending')

  const taskMap = new Map<string, Task>(
    (tasks || []).map((t: Task) => [t.id, t])
  )
  const userMap = new Map<string, User>(
    (users || []).map((u: User) => [u.id, u])
  )

  // Build week tasks
  type WeekTaskItem = {
    entry: ScheduleEntry
    task: Task
    assignedUser: User
    isMe: boolean
    incomingSwap?: SwapRequest
    outgoingSwap?: SwapRequest
  }

  const weekTasks: WeekTaskItem[] = (entries || [])
    .map((entry: ScheduleEntry) => {
      const task = taskMap.get(entry.task_id)
      const assignedUser = userMap.get(entry.user_id)
      if (!task || !assignedUser) return null

      const incomingSwap = (swapRequests || []).find(
        (sr: SwapRequest) =>
          sr.entry_id === entry.id && sr.target_id === profile.id
      )
      const outgoingSwap = (swapRequests || []).find(
        (sr: SwapRequest) =>
          sr.entry_id === entry.id && sr.requester_id === profile.id
      )

      return {
        entry,
        task,
        assignedUser,
        isMe: entry.user_id === profile.id,
        incomingSwap,
        outgoingSwap,
      }
    })
    .filter(Boolean) as WeekTaskItem[]

  // Sort: my tasks first
  weekTasks.sort((a, b) => {
    if (a.isMe && !b.isMe) return -1
    if (!a.isMe && b.isMe) return 1
    return a.task.name.localeCompare(b.task.name)
  })

  const housemates = (users || []).filter(
    (u: User) => u.id !== profile.id
  )

  // Week navigation
  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)

  const sunday = addDays(monday, 6)
  const weekLabel = `${format(monday, 'd MMM', { locale: nl })} – ${format(sunday, 'd MMM yyyy', { locale: nl })}`

  const isCurrentWeek = formatWeekDate(monday) === formatWeekDate(currentMonday)

  return (
    <div className="flex flex-col min-h-full">
      <PushSubscriber />

      {/* Header */}
      <header className="bg-gradient-to-r from-secondary-900 to-secondary-800 px-4 pt-12 pb-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5">
            <img src="/logo.png" alt="Vibehouse" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Schema</h1>
          </div>
          {isCurrentWeek && (
            <span className="badge bg-primary-500 text-secondary-900 font-bold px-3 py-1 rounded-full text-xs">
              Deze week
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Link
            href={`/schema?week=${formatWeekDate(prevMonday)}`}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <span className="text-sm font-semibold text-white">{weekLabel}</span>
          <Link
            href={`/schema?week=${formatWeekDate(nextMonday)}`}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 space-y-3">
        {weekTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🏠</div>
            <p className="text-slate-500 text-sm">
              Geen taken voor deze week.
            </p>
          </div>
        ) : (
          weekTasks.map((wt) => (
            <div
              key={wt.entry.id}
              className={`card ${wt.isMe ? 'border-primary-200 bg-primary-50/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">
                      {wt.task.name}
                    </span>
                    {wt.isMe && (
                      <span className="badge bg-primary-500 text-white text-xs">
                        Jouw taak
                      </span>
                    )}
                    {wt.entry.status === 'done' ? (
                      <span className="badge bg-green-100 text-green-700">
                        Klaar ✓
                      </span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">
                        Te doen
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {wt.isMe ? 'Jij' : wt.assignedUser.name}
                  </p>

                  {/* Incoming swap request */}
                  {wt.incomingSwap && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <p className="text-xs text-amber-700 font-medium">
                        {userMap.get(wt.incomingSwap.requester_id)?.name || 'Iemand'} wil ruilen
                      </p>
                      <SwapResponseButtons
                        swapId={wt.incomingSwap.id}
                        entryId={wt.entry.id}
                        requesterId={wt.incomingSwap.requester_id}
                        currentUserId={profile.id}
                      />
                    </div>
                  )}

                  {/* Outgoing swap request */}
                  {wt.outgoingSwap && !wt.incomingSwap && (
                    <p className="text-xs text-orange-600 mt-1">
                      Ruilverzoek verstuurd naar{' '}
                      {userMap.get(wt.outgoingSwap.target_id)?.name || 'huisgenoot'}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                {wt.isMe && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <MarkDoneButton
                      entryId={wt.entry.id}
                      currentStatus={wt.entry.status}
                    />
                    {!wt.outgoingSwap && wt.entry.status !== 'done' && (
                      <SwapButton
                        entryId={wt.entry.id}
                        requesterId={profile.id}
                        housemates={housemates}
                        existingSwapId={undefined}
                      />
                    )}
                    {wt.outgoingSwap && (
                      <SwapButton
                        entryId={wt.entry.id}
                        requesterId={profile.id}
                        housemates={housemates}
                        existingSwapId={wt.outgoingSwap.id}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
