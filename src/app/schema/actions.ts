'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

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

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .single()
  return profile
}

export async function markDoneAction(entryId: string) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)
  if (!profile) return { error: 'Niet ingelogd' }

  const { data: entry } = await supabase
    .from('schedule_entries')
    .select('user_id')
    .eq('id', entryId)
    .single()

  if (!entry || entry.user_id !== profile.id) return { error: 'Geen toegang' }

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
  const profile = await getProfile(supabase)
  if (!profile) return { error: 'Niet ingelogd' }

  const { data: entry } = await supabase
    .from('schedule_entries')
    .select('user_id')
    .eq('id', entryId)
    .single()

  if (!entry || entry.user_id !== profile.id) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('swap_requests')
    .insert({ requester_id: profile.id, target_id: targetUserId, entry_id: entryId, status: 'pending' })

  if (error) return { error: error.message }
  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true }
}

export async function cancelSwapAction(swapId: string) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)
  if (!profile) return { error: 'Niet ingelogd' }

  const { data: swap } = await supabase
    .from('swap_requests')
    .select('requester_id')
    .eq('id', swapId)
    .single()

  if (!swap || swap.requester_id !== profile.id) return { error: 'Geen toegang' }

  const { error } = await supabase.from('swap_requests').delete().eq('id', swapId)
  if (error) return { error: error.message }
  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true }
}

export async function respondSwapAction(swapId: string, accept: boolean) {
  const supabase = await createClient()
  const profile = await getProfile(supabase)
  if (!profile) return { error: 'Niet ingelogd' }

  const { data: swap } = await supabase
    .from('swap_requests')
    .select('target_id, entry_id')
    .eq('id', swapId)
    .single()

  if (!swap || swap.target_id !== profile.id) return { error: 'Geen toegang' }

  if (accept) {
    const { error: entryError } = await supabase
      .from('schedule_entries')
      .update({ user_id: profile.id })
      .eq('id', swap.entry_id)
    if (entryError) return { error: entryError.message }
  }

  const { error } = await supabase
    .from('swap_requests')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', swapId)

  if (error) return { error: error.message }
  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true }
}
