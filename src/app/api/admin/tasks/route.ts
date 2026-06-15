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
  const { data, error } = await serviceClient.from('tasks').select('*').order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data })
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { name } = await request.json()

  if (!name) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()
  const { data, error } = await serviceClient
    .from('tasks')
    .insert({ name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Geen ID opgegeven' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()
  const { error } = await serviceClient.from('tasks').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
