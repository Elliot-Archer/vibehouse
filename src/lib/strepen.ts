import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from './auth'
import { createNotifications, type NotificationType } from './notifications'
import { sendPushToUser } from './push'

export const STREEP_REASON_MAX = 200

export interface StreepLogEntry {
  id: string
  user_id: string
  giver_id: string | null
  reason: string
  created_at: string
  undone_at: string | null
  undone_by: string | null
}

// The users-table profile of whoever made the request. Uses the verified auth
// user (not just the cookie) because this decides who gets credited.
export async function getRequestProfile(
  service: SupabaseClient
): Promise<{ id: string; name: string } | null> {
  const authUser = await getAuthenticatedUser()
  const email = authUser?.email?.trim().toLowerCase()
  if (!email) return null
  const { data } = await service
    .from('users')
    .select('id, name')
    .eq('email', email)
    .single()
  return data ?? null
}

interface StreepEvent {
  type: Extract<NotificationType, 'streep' | 'streep_undo'>
  actor: { id: string; name: string }
  recipient: { id: string; name: string }
  newCount: number
  reason: string
}

// Tells the whole house about a streep given or undone: an entry in everyone's
// notification feed plus a push to everyone except the person who did it.
// Never throws: a notification failure must not break the streep itself.
export async function notifyStreepEvent(
  service: SupabaseClient,
  { type, actor, recipient, newCount, reason }: StreepEvent
): Promise<void> {
  try {
    const { data: allUsers } = await service.from('users').select('id')
    const ids = (allUsers || []).map((u: { id: string }) => u.id)
    const quoted = `“${reason}”`
    const given = type === 'streep'

    const bodyFor = (id: string): string => {
      const isActor = id === actor.id
      const isRecipient = id === recipient.id
      if (given) {
        if (isActor && isRecipient) return `Je hebt jezelf een streep gegeven: ${quoted}. Je staat nu op ${newCount}`
        if (isActor) return `Je hebt ${recipient.name} een streep gegeven: ${quoted}. ${recipient.name} staat nu op ${newCount}`
        if (isRecipient) return `${actor.name} heeft je een streep gegeven: ${quoted}. Je staat nu op ${newCount}`
        return `${actor.name} heeft ${recipient.name} een streep gegeven: ${quoted}. ${recipient.name} staat nu op ${newCount}`
      }
      if (isActor && isRecipient) return `Je hebt je eigen streep (${quoted}) ongedaan gemaakt. Je staat nu op ${newCount}`
      if (isActor) return `Je hebt de streep van ${recipient.name} (${quoted}) ongedaan gemaakt. ${recipient.name} staat nu op ${newCount}`
      if (isRecipient) return `${actor.name} heeft je streep (${quoted}) ongedaan gemaakt. Je staat nu op ${newCount}`
      return `${actor.name} heeft de streep van ${recipient.name} (${quoted}) ongedaan gemaakt. ${recipient.name} staat nu op ${newCount}`
    }

    await createNotifications(
      service,
      ids.map((id) => ({
        userId: id,
        direction: id === actor.id ? ('outgoing' as const) : ('incoming' as const),
        type,
        actorId: id === actor.id ? recipient.id : actor.id,
        body: bodyFor(id),
        url: '/strepen',
      }))
    )

    const title = (id: string): string => {
      if (given) return id === recipient.id ? '➖ Je hebt een streep gekregen' : `➖ Streep voor ${recipient.name}`
      return id === recipient.id ? '↩️ Je streep is ongedaan gemaakt' : `↩️ Streep van ${recipient.name} ongedaan`
    }

    await Promise.allSettled(
      ids
        .filter((id) => id !== actor.id)
        .map((id) =>
          sendPushToUser(service, id, { title: title(id), body: bodyFor(id), url: '/strepen' })
        )
    )
  } catch (e) {
    console.error('notifyStreepEvent failed:', e)
  }
}
