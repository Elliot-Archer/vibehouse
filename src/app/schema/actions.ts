'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'
import { createNotifications } from '@/lib/notifications'

// Resolves the task name for a schedule entry. Best-effort: returns a fallback
// label when anything is missing so notification bodies always read sensibly.
async function getTaskNameForEntry(
  service: ReturnType<typeof createSupabaseServiceClient>,
  entryId: string
): Promise<string> {
  const { data: entry } = await service
    .from('schedule_entries')
    .select('task_id')
    .eq('id', entryId)
    .single()
  if (!entry?.task_id) return 'een taak'
  const { data: task } = await service
    .from('tasks')
    .select('name')
    .eq('id', entry.task_id)
    .single()
  return task?.name ?? 'een taak'
}

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c: { name: string; value: string; options?: object }[]) =>
          c.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          ),
      },
    }
  )
}

// Resolves the caller's profile id (users.id) from the local session cookie.
// One DB query, no auth-server round-trip.
async function getProfileId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const session = await getSessionUser()
  if (!session) return null
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.email)
    .single()
  return data?.id ?? null
}

export async function markDoneAction(entryId: string) {
  const session = await getSessionUser()
  if (!session) return { error: 'Niet ingelogd' }

  const supabase = await createClient()
  // RLS enforces that only the owner can update this row.
  const { error } = await supabase
    .from('schedule_entries')
    .update({ status: 'done' })
    .eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/schema')
  return { success: true }
}

export async function requestSwapAction(entryId: string, targetUserId: string) {
  const supabase = await createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'Niet ingelogd' }

  // RLS with-check enforces requester_id = own profile id.
  const { error } = await supabase
    .from('swap_requests')
    .insert({ requester_id: profileId, target_id: targetUserId, entry_id: entryId, status: 'pending' })

  if (error) return { error: error.message }

  // Notify the target that someone wants to swap with them, and record the
  // event in both feeds. A push/notification failure must never break the swap.
  try {
    const service = createSupabaseServiceClient()
    const [{ data: requester }, { data: target }, taskName] = await Promise.all([
      service.from('users').select('name').eq('id', profileId).single(),
      service.from('users').select('name').eq('id', targetUserId).single(),
      getTaskNameForEntry(service, entryId),
    ])
    const requesterName = requester?.name ?? 'Iemand'
    const targetName = target?.name ?? 'iemand'

    await createNotifications(service, [
      {
        userId: targetUserId,
        direction: 'incoming',
        type: 'swap_request',
        actorId: profileId,
        body: `${requesterName} wil de taak "${taskName}" met je ruilen`,
        url: '/ruilverzoeken',
      },
      {
        userId: profileId,
        direction: 'outgoing',
        type: 'swap_request',
        actorId: targetUserId,
        body: `Je hebt een ruilverzoek gestuurd naar ${targetName} voor "${taskName}"`,
        url: '/ruilverzoeken',
      },
    ])

    await sendPushToUser(service, targetUserId, {
      title: '🔄 Ruilverzoek ontvangen',
      body: `${requesterName} wil een taak met je ruilen`,
      url: '/ruilverzoeken',
    })
  } catch (e) {
    console.error('Push (requestSwap) failed:', e)
  }

  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true }
}

// Pokes the owner of a task entry to remind them to do it. Records the event
// in both feeds and sends a push. Self-pokes are rejected.
export async function pokeAction(entryId: string) {
  const supabase = await createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'Niet ingelogd' }

  const service = createSupabaseServiceClient()

  const { data: entry } = await service
    .from('schedule_entries')
    .select('user_id, task_id')
    .eq('id', entryId)
    .single()

  if (!entry?.user_id) return { error: 'Taak niet gevonden' }
  if (entry.user_id === profileId) return { error: 'Je kunt jezelf niet porren' }

  const [{ data: sender }, { data: target }, { data: task }] = await Promise.all([
    service.from('users').select('name').eq('id', profileId).single(),
    service.from('users').select('name').eq('id', entry.user_id).single(),
    service.from('tasks').select('name').eq('id', entry.task_id).single(),
  ])
  const senderName = sender?.name ?? 'Iemand'
  const targetName = target?.name ?? 'iemand'
  const taskName = task?.name ?? 'een taak'

  try {
    await createNotifications(service, [
      {
        userId: entry.user_id,
        direction: 'incoming',
        type: 'poke',
        actorId: profileId,
        body: `${senderName} herinnert je eraan om "${taskName}" te doen`,
        url: '/schema',
      },
      {
        userId: profileId,
        direction: 'outgoing',
        type: 'poke',
        actorId: entry.user_id,
        body: `Je hebt ${targetName} herinnerd aan de taak "${taskName}"`,
        url: '/schema',
      },
    ])

    await sendPushToUser(service, entry.user_id, {
      title: '👉 Herinnering',
      body: `${senderName} herinnert je aan je taak: ${taskName}`,
      url: '/schema',
    })
  } catch (e) {
    console.error('Push (poke) failed:', e)
  }

  revalidatePath('/schema')
  return { success: true }
}

export async function cancelSwapAction(swapId: string) {
  const session = await getSessionUser()
  if (!session) return { error: 'Niet ingelogd' }

  const supabase = await createClient()
  // RLS enforces that only the requester can delete.
  const { error } = await supabase.from('swap_requests').delete().eq('id', swapId)
  if (error) return { error: error.message }
  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true }
}

export async function respondSwapAction(swapId: string, accept: boolean) {
  const supabase = await createClient()
  const profileId = await getProfileId(supabase)
  if (!profileId) return { error: 'Niet ingelogd' }

  const { data: swap } = await supabase
    .from('swap_requests')
    .select('target_id, entry_id, requester_id')
    .eq('id', swapId)
    .single()

  if (!swap || swap.target_id !== profileId) return { error: 'Geen toegang' }

  const service = createSupabaseServiceClient()

  if (accept) {
    // Transferring the entry to a new owner requires bypassing the
    // owner-only RLS update policy. Caller is verified as the swap target above.
    const { error: entryError } = await service
      .from('schedule_entries')
      .update({ user_id: profileId })
      .eq('id', swap.entry_id)
    if (entryError) return { error: entryError.message }
  }

  const { error } = await supabase
    .from('swap_requests')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', swapId)

  if (error) return { error: error.message }

  // Notify the original requester of the response and record it in both feeds.
  // A push/notification failure must never break the response itself.
  try {
    const [{ data: responder }, { data: requester }, taskName] = await Promise.all([
      service.from('users').select('name').eq('id', profileId).single(),
      swap.requester_id
        ? service.from('users').select('name').eq('id', swap.requester_id).single()
        : Promise.resolve({ data: null }),
      getTaskNameForEntry(service, swap.entry_id),
    ])
    const responderName = responder?.name ?? 'Iemand'
    const requesterName = requester?.name ?? 'iemand'

    if (swap.requester_id) {
      await createNotifications(service, [
        {
          userId: swap.requester_id,
          direction: 'incoming',
          type: accept ? 'swap_accepted' : 'swap_declined',
          actorId: profileId,
          body: accept
            ? `${responderName} heeft je ruilverzoek voor "${taskName}" geaccepteerd`
            : `${responderName} heeft je ruilverzoek voor "${taskName}" afgewezen`,
          url: '/ruilverzoeken',
        },
        {
          userId: profileId,
          direction: 'outgoing',
          type: accept ? 'swap_accepted' : 'swap_declined',
          actorId: swap.requester_id,
          body: accept
            ? `Je hebt het ruilverzoek van ${requesterName} voor "${taskName}" geaccepteerd`
            : `Je hebt het ruilverzoek van ${requesterName} voor "${taskName}" afgewezen`,
          url: '/ruilverzoeken',
        },
      ])

      await sendPushToUser(service, swap.requester_id, {
        title: accept ? '✅ Ruilverzoek geaccepteerd' : '❌ Ruilverzoek afgewezen',
        body: accept
          ? `${responderName} heeft je ruilverzoek geaccepteerd!`
          : `${responderName} heeft je ruilverzoek afgewezen.`,
        url: '/ruilverzoeken',
      })
    }
  } catch (e) {
    console.error('Push (respondSwap) failed:', e)
  }

  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true }
}
