import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('email', authUser.email)
    .single()

  if (!profile) redirect('/login')

  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)
  if (!adminIds.includes(authUser.id)) {
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

  // Fetch initial data
  const { data: users } = await supabase.from('users').select('*').order('name')
  const { data: tasks } = await supabase.from('tasks').select('*').order('name')
  const { data: taskMembers } = await supabase
    .from('task_members')
    .select('*')
    .order('order')

  return (
    <AdminPanel
      initialUsers={users || []}
      initialTasks={tasks || []}
      initialTaskMembers={taskMembers || []}
    />
  )
}
