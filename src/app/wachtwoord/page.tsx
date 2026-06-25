import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session'
import ProfileClient from './ProfileClient'

export default async function ProfielPage() {
  const session = await getSessionUser()
  if (!session) redirect('/login')

  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)
  const isAdmin = adminIds.includes(session.id)

  const supabase = await createSupabaseServerClient()
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('email', session.email)
    .single()

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-gradient-to-r from-secondary-900 to-secondary-800 px-4 pt-12 pb-6 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Tjokkellust" className="w-14 h-14 object-contain drop-shadow-lg" />
          <div>
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest">Profiel</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Tjokkellust</h1>
          </div>
        </div>
      </header>

      <ProfileClient
        initialName={profile?.name ?? ''}
        initialAvatarUrl={profile?.avatar_url ?? null}
        isAdmin={isAdmin}
      />
    </div>
  )
}
