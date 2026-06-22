import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session'
import type { User } from '@/types'
import type { NotificationRow, NotificationType } from '@/lib/notifications'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import Avatar from '../Avatar'

const TYPE_ICON: Record<NotificationType, string> = {
  swap_request: '🔄',
  swap_accepted: '✅',
  swap_declined: '❌',
  poke: '👉',
  streep: '➖',
  weekly_reminder: '🔔',
  waste_reminder: '🗑️',
}

export default async function MeldingenPage() {
  const supabase = await createSupabaseServerClient()

  const session = await getSessionUser()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.email)
    .single()

  if (!profile) redirect('/login')

  // Notifications are read via the service client (RLS denies anon access);
  // we only ever read this user's own feed.
  const service = createSupabaseServiceClient()
  const { data: notifications } = await service
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  const rows = (notifications || []) as NotificationRow[]

  // Fetch actor users for avatars/names.
  const actorIds = [...new Set(rows.map((n) => n.actor_id).filter(Boolean))] as string[]
  const { data: actors } = await service
    .from('users')
    .select('id, name, avatar_url')
    .in('id', actorIds.length > 0 ? actorIds : ['none'])

  const actorMap = new Map<string, Pick<User, 'id' | 'name' | 'avatar_url'>>(
    (actors || []).map((u) => [u.id, u])
  )

  const incoming = rows.filter((n) => n.direction === 'incoming')
  const outgoing = rows.filter((n) => n.direction === 'outgoing')

  function NotificationItem({ n }: { n: NotificationRow }) {
    const actor = n.actor_id ? actorMap.get(n.actor_id) : null
    const when = (() => {
      try {
        return formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: nl })
      } catch {
        return ''
      }
    })()

    const inner = (
      <div className="card flex items-start gap-3">
        {actor ? (
          <Avatar
            name={actor.name}
            src={actor.avatar_url}
            className="w-10 h-10 rounded-xl border border-slate-200"
            fallbackClassName="bg-secondary-100 text-secondary-600 text-sm border border-secondary-200"
          />
        ) : (
          <span className="w-10 h-10 rounded-xl bg-primary-100 text-lg flex items-center justify-center flex-shrink-0 border border-primary-200">
            {TYPE_ICON[n.type] ?? '🔔'}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-800 leading-snug">
            <span className="mr-1">{TYPE_ICON[n.type] ?? '🔔'}</span>
            {n.body}
          </p>
          {when && <p className="text-xs text-slate-400 mt-1">{when}</p>}
        </div>
      </div>
    )

    return n.url ? (
      <Link href={n.url} className="block">
        {inner}
      </Link>
    ) : (
      inner
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
            <h1 className="text-2xl font-bold text-white leading-tight">Tjokkellust</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 space-y-6">
        {rows.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-slate-500 text-sm">Nog geen meldingen deze week.</p>
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span>📥 Inkomend</span>
                {incoming.length > 0 && (
                  <span className="badge bg-amber-100 text-amber-700 text-xs font-bold">
                    {incoming.length}
                  </span>
                )}
              </h2>
              {incoming.length === 0 ? (
                <p className="text-xs text-slate-400">Geen inkomende meldingen.</p>
              ) : (
                <div className="space-y-3">
                  {incoming.map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <span>📤 Uitgaand</span>
                {outgoing.length > 0 && (
                  <span className="badge bg-blue-100 text-blue-700 text-xs font-bold">
                    {outgoing.length}
                  </span>
                )}
              </h2>
              {outgoing.length === 0 ? (
                <p className="text-xs text-slate-400">Geen uitgaande meldingen.</p>
              ) : (
                <div className="space-y-3">
                  {outgoing.map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
