import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session'
import type { SwapRequest, User, Task, ScheduleEntry } from '@/types'
import SwapResponseButtons from '../schema/SwapResponseButtons'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

export default async function MeldingenPage() {
  const supabase = await createSupabaseServerClient()

  const session = await getSessionUser()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('email', session.email)
    .single()

  if (!profile) redirect('/login')

  // Fetch sent and received swap requests in parallel
  const [{ data: sent }, { data: received }] = await Promise.all([
    supabase
      .from('swap_requests')
      .select('*')
      .eq('requester_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('swap_requests')
      .select('*')
      .eq('target_id', profile.id)
      .order('created_at', { ascending: false }),
  ])

  // Fetch related data
  const allSwaps = [...(sent || []), ...(received || [])]
  const entryIds = allSwaps.map((s) => s.entry_id)
  const { data: entries } = await supabase
    .from('schedule_entries')
    .select('*')
    .in('id', entryIds.length > 0 ? entryIds : ['none'])

  const taskIds = (entries || []).map((e: ScheduleEntry) => e.task_id)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('id', taskIds.length > 0 ? taskIds : ['none'])

  const userIds = [
    ...new Set(allSwaps.flatMap((s) => [s.requester_id, s.target_id])),
  ]
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .in('id', userIds.length > 0 ? userIds : ['none'])

  const entryMap = new Map<string, ScheduleEntry>(
    (entries || []).map((e: ScheduleEntry) => [e.id, e])
  )
  const taskMap = new Map<string, Task>(
    (tasks || []).map((t: Task) => [t.id, t])
  )
  const userMap = new Map<string, User>(
    (users || []).map((u: User) => [u.id, u])
  )

  // Separate incoming (received) and outgoing (sent)
  const incomingPending = (received || []).filter((s) => s.status === 'pending')
  const outgoingPending = (sent || []).filter((s) => s.status === 'pending')
  const otherPending = allSwaps.filter(
    (s) => s.status !== 'pending' && s.status !== 'accepted' && s.status !== 'declined'
  )

  function NotificationCard({
    swap,
    isIncoming,
  }: {
    swap: SwapRequest
    isIncoming: boolean
  }) {
    const entry = entryMap.get(swap.entry_id)
    const task = entry ? taskMap.get(entry.task_id) : null
    const otherUserId = isIncoming ? swap.requester_id : swap.target_id
    const otherUser = userMap.get(otherUserId)

    const weekLabel = entry
      ? format(new Date(entry.week + 'T00:00:00Z'), 'd MMM yyyy', { locale: nl })
      : 'Onbekende week'

    return (
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-medium text-sm text-slate-900">
              {task?.name || 'Onbekende taak'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Week van {weekLabel}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isIncoming
                ? `Ruilverzoek van: ${otherUser?.name || 'Onbekend'}`
                : `Ruilverzoek naar: ${otherUser?.name || 'Onbekend'}`}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            {swap.status === 'pending' && (
              <span className="badge bg-amber-100 text-amber-700 text-xs font-medium">
                Openstaand
              </span>
            )}
            {swap.status === 'accepted' && (
              <span className="badge bg-green-100 text-green-700 text-xs font-medium">
                Geaccepteerd
              </span>
            )}
            {swap.status === 'declined' && (
              <span className="badge bg-red-100 text-red-700 text-xs font-medium">
                Afgewezen
              </span>
            )}
          </div>
        </div>
        {swap.status === 'pending' && isIncoming && entry && (
          <SwapResponseButtons
            swapId={swap.id}
            entryId={swap.entry_id}
            requesterId={swap.requester_id}
            currentUserId={profile.id}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-gradient-to-r from-secondary-900 to-secondary-800 px-4 pt-12 pb-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Tjokkellust"
            className="w-14 h-14 object-contain drop-shadow-lg"
          />
          <div>
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest">
              Meldingen
            </p>
            <h1 className="text-2xl font-bold text-white leading-tight">
              Tjokkellust
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 space-y-6">
        {incomingPending.length === 0 && outgoingPending.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-slate-500 text-sm">Geen openstaande ruilverzoeken.</p>
          </div>
        ) : (
          <>
            {/* Incoming requests */}
            {incomingPending.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <span>📥 Inkomend</span>
                  <span className="badge bg-amber-100 text-amber-700 text-xs font-bold">
                    {incomingPending.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {incomingPending.map((s) => (
                    <NotificationCard key={s.id} swap={s} isIncoming={true} />
                  ))}
                </div>
              </section>
            )}

            {/* Outgoing requests */}
            {outgoingPending.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <span>📤 Verzonden</span>
                  <span className="badge bg-blue-100 text-blue-700 text-xs font-bold">
                    {outgoingPending.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {outgoingPending.map((s) => (
                    <NotificationCard key={s.id} swap={s} isIncoming={false} />
                  ))}
                </div>
              </section>
            )}

            {/* Completed requests */}
            {(allSwaps.filter((s) =>
              ['accepted', 'declined'].includes(s.status)
            ).length > 0) && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Afgerond ({allSwaps.filter((s) =>
                    ['accepted', 'declined'].includes(s.status)
                  ).length})
                </h2>
                <div className="space-y-3">
                  {allSwaps
                    .filter((s) =>
                      ['accepted', 'declined'].includes(s.status)
                    )
                    .map((s) => (
                      <NotificationCard
                        key={s.id}
                        swap={s}
                        isIncoming={s.target_id === profile.id}
                      />
                    ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
