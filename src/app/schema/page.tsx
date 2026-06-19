import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session'
import { getCurrentMonday, formatWeekDate, getMonday } from '@/lib/schedule'
import { upsertWeekSchedule, ensureWasteEntry, WASTE_TASK_NAME } from '@/lib/schedule'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import type { Task, User, ScheduleEntry, SwapRequest } from '@/types'
import MarkDoneButton from './MarkDoneButton'
import SwapButton from './SwapButton'
import SwapResponseButtons from './SwapResponseButtons'
import PushSubscriber from './PushSubscriber'
import { format, addDays } from 'date-fns'
import { nl } from 'date-fns/locale'
import {
  getWastePickupsInWeek,
  getWasteTypeLabel,
  type WasteType,
} from '@/lib/waste'

interface PageProps {
  searchParams: Promise<{ week?: string }>
}

export default async function SchemaPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createSupabaseServerClient()

  // Read session from the cookie locally (no auth-server round-trip).
  const session = await getSessionUser()
  if (!session) redirect('/login')

  // Determine which week to show
  let monday: Date
  if (params.week) {
    const parsed = new Date(params.week + 'T12:00:00')
    monday = isNaN(parsed.getTime()) ? getCurrentMonday() : getMonday(parsed)
  } else {
    monday = getCurrentMonday()
  }

  const weekStr = formatWeekDate(monday)
  const currentMonday = getCurrentMonday()

  // Ensure a waste responsibility entry exists (defaults to Elliot) for any
  // current/future week that has a pickup, so it shows up swappable below.
  const elliotUserId = process.env.ELLIOT_USER_ID
  const weekWastePickups = getWastePickupsInWeek(monday)
  if (
    elliotUserId &&
    weekWastePickups.length > 0 &&
    monday.getTime() >= currentMonday.getTime()
  ) {
    try {
      await ensureWasteEntry(createSupabaseServiceClient(), monday, elliotUserId)
    } catch (_) {
      // Non-fatal: the card still renders as info even without an entry.
    }
  }

  // Fetch the profile, this week's entries, all tasks and all users in parallel.
  const [
    { data: profile },
    { data: initialEntries },
    { data: tasks },
    { data: users },
  ] = await Promise.all([
    supabase.from('users').select('*').eq('email', session.email).single(),
    supabase.from('schedule_entries').select('*').eq('week', weekStr),
    supabase.from('tasks').select('*'),
    supabase.from('users').select('*'),
  ])

  if (!profile) redirect('/login')

  // Generate the schedule only if it's missing for a current/future week.
  let entries = initialEntries
  if (
    (!entries || entries.length === 0) &&
    monday.getTime() >= currentMonday.getTime()
  ) {
    try {
      await upsertWeekSchedule(supabase, monday)
      const { data: regenerated } = await supabase
        .from('schedule_entries')
        .select('*')
        .eq('week', weekStr)
      entries = regenerated
    } catch (_) {
      // Continue even if upsert fails
    }
  }

  // Fetch pending swap requests for this week's entries
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

  const wasteTaskId = (tasks || []).find((t: Task) => t.name === WASTE_TASK_NAME)?.id

  const weekTasks: WeekTaskItem[] = (entries || [])
    .filter((entry: ScheduleEntry) => entry.task_id !== wasteTaskId)
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

  // Build the waste responsibility item from its schedule entry (if any),
  // falling back to Elliot for display when no entry exists yet.
  const wasteEntry = (entries || []).find(
    (e: ScheduleEntry) => e.task_id === wasteTaskId
  )
  const wasteUser = wasteEntry
    ? userMap.get(wasteEntry.user_id)
    : elliotUserId
      ? userMap.get(elliotUserId)
      : undefined
  const wasteIsMe = !!wasteEntry && wasteEntry.user_id === profile.id
  const wasteIncomingSwap = wasteEntry
    ? (swapRequests || []).find(
        (sr: SwapRequest) =>
          sr.entry_id === wasteEntry.id && sr.target_id === profile.id
      )
    : undefined
  const wasteOutgoingSwap = wasteEntry
    ? (swapRequests || []).find(
        (sr: SwapRequest) =>
          sr.entry_id === wasteEntry.id && sr.requester_id === profile.id
      )
    : undefined

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
          <img src="/logo.png" alt="Tjokkellust" className="w-14 h-14 object-contain drop-shadow-lg" />
          <div className="flex-1">
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest">Schema</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Tjokkellust</h1>
          </div>
          {isCurrentWeek ? (
            <span className="badge bg-primary-400 text-secondary-900 font-bold px-3 py-1 rounded-full text-xs">
              Deze week
            </span>
          ) : (
            <Link
              href="/schema"
              className="text-xs font-semibold text-white bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1"
            >
              Naar huidige week
            </Link>
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
        {weekWastePickups.length > 0 && (
          <div className={`card border-emerald-200 bg-emerald-50/50 ${wasteIsMe ? 'ring-1 ring-primary-200' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {wasteUser?.avatar_url ? (
                  <img
                    src={wasteUser.avatar_url}
                    alt={wasteUser.name}
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                  />
                ) : (
                  <span className="w-11 h-11 rounded-xl bg-secondary-100 text-secondary-600 text-base font-bold flex items-center justify-center flex-shrink-0 border border-secondary-200">
                    {(wasteUser?.name || 'V').charAt(0).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">Vuilnis</span>
                    {wasteIsMe && (
                      <span className="badge badge-static bg-primary-400 text-secondary-900 text-xs font-semibold">
                        Jouw taak
                      </span>
                    )}
                    {wasteEntry?.status === 'done' && (
                      <span className="badge badge-static bg-green-100 text-green-700">Klaar ✓</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {wasteIsMe ? 'Jij' : wasteUser?.name || 'Onbekend'}
                  </p>

                  <div className="mt-2 space-y-1">
                    {weekWastePickups.map((pickup) => {
                      const reminderDate = addDays(new Date(`${pickup.datum}T12:00:00`), -1)
                      return (
                        <div key={`${pickup.datum}-${pickup.type}`} className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getWasteTypeBadgeClasses(pickup.type)}`}>
                            {getWasteTypeLabel(pickup.type)}
                          </span>
                          <span className="text-xs text-slate-600">
                            {`${capitalizeFirst(format(reminderDate, 'EEEE', { locale: nl }))}avond ${format(reminderDate, 'd MMMM', { locale: nl })}`}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Incoming swap request */}
                  {wasteEntry && wasteIncomingSwap && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <p className="text-xs text-amber-700 font-medium">
                        {userMap.get(wasteIncomingSwap.requester_id)?.name || 'Iemand'} wil ruilen
                      </p>
                      <SwapResponseButtons
                        swapId={wasteIncomingSwap.id}
                        entryId={wasteEntry.id}
                        requesterId={wasteIncomingSwap.requester_id}
                        currentUserId={profile.id}
                      />
                    </div>
                  )}

                  {/* Outgoing swap request */}
                  {wasteEntry && wasteOutgoingSwap && !wasteIncomingSwap && (
                    <p className="text-xs text-orange-600 mt-1">
                      Ruilverzoek verstuurd naar{' '}
                      {userMap.get(wasteOutgoingSwap.target_id)?.name || 'huisgenoot'}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons (only when the waste task is mine) */}
              {wasteEntry && wasteIsMe && (
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <MarkDoneButton entryId={wasteEntry.id} currentStatus={wasteEntry.status} />
                  {!wasteOutgoingSwap && wasteEntry.status !== 'done' && (
                    <SwapButton
                      entryId={wasteEntry.id}
                      requesterId={profile.id}
                      housemates={housemates}
                      existingSwapId={undefined}
                    />
                  )}
                  {wasteOutgoingSwap && (
                    <SwapButton
                      entryId={wasteEntry.id}
                      requesterId={profile.id}
                      housemates={housemates}
                      existingSwapId={wasteOutgoingSwap.id}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

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
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {wt.assignedUser.avatar_url ? (
                    <img
                      src={wt.assignedUser.avatar_url}
                      alt={wt.assignedUser.name}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-xl bg-secondary-100 text-secondary-600 text-base font-bold flex items-center justify-center flex-shrink-0 border border-secondary-200">
                      {wt.assignedUser.name.charAt(0).toUpperCase()}
                    </span>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">
                        {wt.task.name}
                      </span>
                      {wt.isMe && (
                        <span className="badge badge-static bg-primary-400 text-secondary-900 text-xs font-semibold">
                          Jouw taak
                        </span>
                      )}
                      {wt.entry.status === 'done' ? (
                        <span className="badge badge-static bg-green-100 text-green-700">
                          Klaar ✓
                        </span>
                      ) : (
                        <span className="badge badge-static bg-slate-100 text-slate-500">
                          Te doen
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-500">
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

function getWasteTypeBadgeClasses(type: WasteType): string {
  if (type === 'restafval') return 'bg-slate-200 text-slate-800'
  if (type === 'gft') return 'bg-green-100 text-green-800'
  return 'bg-blue-100 text-blue-800'
}

function capitalizeFirst(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
