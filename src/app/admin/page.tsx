import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()

  const session = await getSessionUser()
  if (!session) redirect('/login')

  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)
  if (!adminIds.includes(session.id)) {
    return (
      <div className="px-4 pt-12">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Beheer</h1>
        <div className="card border-red-200 bg-red-50">
          <p className="text-red-700 text-sm font-medium">Geen toegang</p>
          <p className="text-red-600 text-xs mt-1">
            Je hebt geen beheerdersrechten.
          </p>
        </div>
      </div>
    )
  }

  // Fetch initial data in parallel
  const [{ data: users }, { data: tasks }, { data: taskMembers }, { data: subs }] =
    await Promise.all([
      supabase.from('users').select('*').order('name'),
      supabase.from('tasks').select('*').order('name'),
      supabase.from('task_members').select('*').order('order'),
      supabase.from('push_subscriptions').select('user_id'),
    ])

  const subscribedUserIds = [...new Set((subs || []).map((s) => s.user_id))]

  return (
    <AdminPanel
      initialUsers={users || []}
      initialTasks={tasks || []}
      initialTaskMembers={taskMembers || []}
      subscribedUserIds={subscribedUserIds}
    />
  )
}
