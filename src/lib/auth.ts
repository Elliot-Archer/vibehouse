import { createSupabaseServerClient } from './supabase-server'

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function getAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)
}

export async function isAdminRequest(): Promise<boolean> {
  const user = await getAuthenticatedUser()
  if (!user) return false
  return getAdminIds().includes(user.id)
}
