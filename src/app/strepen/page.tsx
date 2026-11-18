import { redirect } from 'next/navigation'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'
import type { StreepLogEntry } from '@/lib/strepen'
import { getSessionUser } from '@/lib/session'
import type { User } from '@/types'
import StrepenClient from './StrepenClient'

export default async function StrepenPage() {
  const session = await getSessionUser()
  if (!session) redirect('/login')

  const supabase = await createSupabaseServerClient()

  // Get current user to check if admin
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.email)
    .single()

  if (!profile) redirect('/login')

  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)
  const isAdmin = adminIds.includes(session.id)

  // Fetch all users with their strepen
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, strepen')
    .order('name')

  // If strepen column doesn't exist yet, fetch without it
  let userList = users || []
  if (error && error.message.includes('strepen')) {
    const { data: usersWithoutStrepen } = await supabase
      .from('users')
      .select('id, name, email, avatar_url')
      .order('name')
    userList = (usersWithoutStrepen || []).map((u) => ({
      ...u,
      strepen: 0,
    }))
  }

  // Strepen log. Read via the service role (the table has no public RLS
  // policies). If the table doesn't exist yet, logAvailable stays false and
  // the page falls back to just the counters.
  const { data: logRows, error: logError } = await createSupabaseServiceClient()
    .from('streep_log')
    .select('id, user_id, giver_id, reason, created_at, undone_at, undone_by')
    .order('created_at', { ascending: false })
    .limit(100)

  if (logError) console.error('streep_log read failed:', logError.message)

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-gradient-to-r from-secondary-900 to-secondary-800 px-4 pt-12 pb-6 shadow-lg">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Tjokkellust"
            className="w-14 h-14 object-contain drop-shadow-lg"
          />
          <div>
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest">
              Strepen
            </p>
            <h1 className="text-2xl font-bold text-white leading-tight">
              Tjokkellust
            </h1>
          </div>
        </div>
      </header>

      <StrepenClient
        users={(userList || []) as User[]}
        isAdmin={isAdmin}
        log={(logRows || []) as StreepLogEntry[]}
        logAvailable={!logError}
      />
    </div>
  )
}
