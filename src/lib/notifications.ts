import type { SupabaseClient } from '@supabase/supabase-js'

// Event kinds. Drives the icon shown in the notification center.
export type NotificationType =
  | 'swap_request'
  | 'swap_accepted'
  | 'swap_declined'
  | 'poke'
  | 'streep'
  | 'weekly_reminder'
  | 'waste_reminder'

export type NotificationDirection = 'incoming' | 'outgoing'

export interface NotificationRow {
  id: string
  user_id: string
  direction: NotificationDirection
  type: NotificationType
  actor_id: string | null
  body: string
  url: string | null
  read: boolean
  created_at: string
}

interface NewNotification {
  userId: string
  direction: NotificationDirection
  type: NotificationType
  body: string
  actorId?: string | null
  url?: string | null
}

// Writes one or more notification rows. Always call with a service-role client
// (RLS denies anon/authenticated). Never throws: a logging failure must never
// break the action that triggered it.
export async function createNotifications(
  service: SupabaseClient,
  notifications: NewNotification[]
): Promise<void> {
  if (notifications.length === 0) return
  try {
    const rows = notifications.map((n) => ({
      user_id: n.userId,
      direction: n.direction,
      type: n.type,
      body: n.body,
      actor_id: n.actorId ?? null,
      url: n.url ?? null,
    }))
    const { error } = await service.from('notifications').insert(rows)
    if (error) console.error('createNotifications failed:', error.message)
  } catch (e) {
    console.error('createNotifications threw:', e)
  }
}
