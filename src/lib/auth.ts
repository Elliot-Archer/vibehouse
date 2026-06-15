import { createSupabaseServerClient } from './supabase-server'

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function isAdminRequest(): Promise<boolean> {
  const user = await getAuthenticatedUser()
  if (!user) return false
  return user.id === process.env.ADMIN_USER_ID
}
