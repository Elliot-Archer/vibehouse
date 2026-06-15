import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'

async function isAdmin(request: NextRequest): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) return false

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('email', authUser.email)
    .single()

  return profile?.id === process.env.ADMIN_USER_ID
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const serviceClient = createSupabaseServiceClient()
  const { data, error } = await serviceClient
    .from('task_members')
    .select('*')
    .order('order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ taskMembers: data })
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { taskId, members } = await request.json()

  if (!taskId || !Array.isArray(members)) {
    return NextResponse.json({ error: 'Ongeldige parameters' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()

  // Delete existing members for this task
  const { error: deleteError } = await serviceClient
    .from('task_members')
    .delete()
    .eq('task_id', taskId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  if (members.length > 0) {
    const { error: insertError } = await serviceClient
      .from('task_members')
      .insert(
        members.map((m: { user_id: string; order: number }) => ({
          task_id: taskId,
          user_id: m.user_id,
          order: m.order,
        }))
      )

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
