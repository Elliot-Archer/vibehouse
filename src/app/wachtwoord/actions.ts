'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase-server'

async function createCookieClient() {
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

// Updates the caller's display name (nickname) and, optionally, avatar.
// avatarDataUrl is a base64 data URL produced client-side (already resized).
export async function updateProfileAction(input: {
  nickname?: string
  avatarDataUrl?: string
}) {
  const session = await getSessionUser()
  if (!session) return { error: 'Niet ingelogd' }

  const service = createSupabaseServiceClient()

  // Resolve profile id from email
  const { data: profile } = await service
    .from('users')
    .select('id')
    .eq('email', session.email)
    .single()
  if (!profile) return { error: 'Profiel niet gevonden' }

  const updates: { name?: string; avatar_url?: string } = {}

  const nickname = input.nickname?.trim()
  if (nickname) updates.name = nickname

  if (input.avatarDataUrl) {
    const match = input.avatarDataUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/)
    if (!match) return { error: 'Ongeldige afbeelding' }
    const contentType = match[1]
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2]
    const bytes = Buffer.from(match[3], 'base64')

    const path = `${profile.id}/avatar-${Date.now()}.${ext}`
    const { error: uploadError } = await service.storage
      .from('avatars')
      .upload(path, bytes, { contentType, upsert: true })
    if (uploadError) return { error: uploadError.message }

    const { data: pub } = service.storage.from('avatars').getPublicUrl(path)
    updates.avatar_url = pub.publicUrl
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'Niets om bij te werken' }
  }

  const { error } = await service.from('users').update(updates).eq('id', profile.id)
  if (error) return { error: error.message }

  revalidatePath('/wachtwoord')
  revalidatePath('/schema')
  revalidatePath('/ruilverzoeken')
  return { success: true, avatarUrl: updates.avatar_url, name: updates.name }
}

export async function updatePasswordAction(password: string) {
  if (password.length < 8) return { error: 'Wachtwoord moet minimaal 8 tekens zijn' }
  const supabase = await createCookieClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  return { success: true }
}
