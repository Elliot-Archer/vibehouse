'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase-server'

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
  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
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
    .select('target_id, entry_id')
    .eq('id', swapId)
    .single()

  if (!swap || swap.target_id !== profileId) return { error: 'Geen toegang' }

  if (accept) {
    // Transferring the entry to a new owner requires bypassing the
    // owner-only RLS update policy. Caller is verified as the swap target above.
    const service = createSupabaseServiceClient()
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
  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true }
}
