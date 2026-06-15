import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToUser(
  supabaseClient: SupabaseClient,
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  const { data: subscriptions, error } = await supabaseClient
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)

  if (error || !subscriptions) return

  await Promise.allSettled(
    subscriptions.map((row) =>
      webpush.sendNotification(
        row.subscription as webpush.PushSubscription,
        JSON.stringify(payload)
      )
    )
  )
}

export { webpush }
