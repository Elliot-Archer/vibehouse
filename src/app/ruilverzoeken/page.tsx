import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session'
import type { SwapRequest, User, Task, ScheduleEntry } from '@/types'
import SwapResponseButtons from '../schema/SwapResponseButtons'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

export default async function RuilverzoekPage() {
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
      .order('id', { ascending: false }),
    supabase
      .from('swap_requests')
      .select('*')
      .eq('target_id', profile.id)
      .order('id', { ascending: false }),
  ])

  const allSwaps = [
    ...((sent || []).map((s: SwapRequest) => ({ ...s, direction: 'sent' as const }))),
    ...((received || []).map((s: SwapRequest) => ({
      ...s,
      direction: 'received' as const,
    }))),
  ]

  // Fetch related data
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

  const pending = allSwaps.filter((s) => s.status === 'pending')
  const accepted = allSwaps.filter((s) => s.status === 'accepted')
  const declined = allSwaps.filter((s) => s.status === 'declined')

  function SwapCard({
    swap,
    direction,
  }: {
    swap: SwapRequest & { direction: 'sent' | 'received' }
    direction: 'sent' | 'received'
  }) {
    const entry = entryMap.get(swap.entry_id)
    const task = entry ? taskMap.get(entry.task_id) : null
    const otherUserId =
      direction === 'sent' ? swap.target_id : swap.requester_id
    const otherUser = userMap.get(otherUserId)

    const weekLabel = entry
      ? format(new Date(entry.week + 'T00:00:00Z'), 'd MMM yyyy', { locale: nl })
      : 'Onbekende week'

    return (
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm text-slate-900">
              {task?.name || 'Onbekende taak'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Week van {weekLabel}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {direction === 'sent'
                ? `Gevraagd aan: ${otherUser?.name || 'Onbekend'}`
                : `Verzoek van: ${otherUser?.name || 'Onbekend'}`}
            </p>
          </div>
          <div className="flex-shrink-0">
            {swap.status === 'pending' && (
              <span className="badge bg-amber-100 text-amber-700">
                In afwachting
              </span>
            )}
            {swap.status === 'accepted' && (
              <span className="badge bg-green-100 text-green-700">
                Geaccepteerd
              </span>
            )}
            {swap.status === 'declined' && (
              <span className="badge bg-red-100 text-red-700">Afgewezen</span>
            )}
          </div>
        </div>
        {swap.status === 'pending' && direction === 'received' && entry && (
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
    <div>
      <header className="bg-gradient-to-r from-secondary-900 to-secondary-800 px-4 pt-12 pb-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Tjokkellust" className="w-14 h-14 object-contain drop-shadow-lg" />
          <div>
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest">Ruilen</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Tjokkellust</h1>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {allSwaps.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🤝</div>
            <p className="text-slate-500 text-sm">
              Geen ruilverzoeken gevonden.
            </p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Openstaand ({pending.length})
                </h2>
                <div className="space-y-3">
                  {pending.map((s) => (
                    <SwapCard key={`${s.id}-${s.direction}`} swap={s} direction={s.direction} />
                  ))}
                </div>
              </section>
            )}

            {accepted.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Geaccepteerd ({accepted.length})
                </h2>
                <div className="space-y-3">
                  {accepted.map((s) => (
                    <SwapCard key={`${s.id}-${s.direction}`} swap={s} direction={s.direction} />
                  ))}
                </div>
              </section>
            )}

            {declined.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Afgewezen ({declined.length})
                </h2>
                <div className="space-y-3">
                  {declined.map((s) => (
                    <SwapCard key={`${s.id}-${s.direction}`} swap={s} direction={s.direction} />
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
