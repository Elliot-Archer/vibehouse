import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  void request
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const serviceClient = createSupabaseServiceClient()
  const { data, error } = await serviceClient.from('users').select('*').order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const body = await request.json()
  const name = String(body.name ?? '').trim()
  // Store emails lowercase: profiles are looked up by exact email match.
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = body.password

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Alle velden zijn verplicht' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()

  // Create auth user
  const { data: authData, error: authError } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Create profile in users table
  const { data: userProfile, error: profileError } = await serviceClient
    .from('users')
    .insert({ name, email, id: authData.user.id })
    .select()
    .single()

  if (profileError) {
    // Rollback auth user
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ user: userProfile })
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Geen ID opgegeven' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()

  const { data: profile } = await serviceClient
    .from('users')
    .select('email')
    .eq('id', id)
    .single()

  const { error: profileError } = await serviceClient
    .from('users')
    .delete()
    .eq('id', id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Delete the login too. Older profiles have a users.id that differs from
  // their auth id, so find the auth account by email instead of by id —
  // otherwise the login silently survives without a profile.
  if (profile?.email) {
    const { data: authList } = await serviceClient.auth.admin.listUsers({ perPage: 1000 })
    const authUser = authList?.users.find(
      (u) => u.email?.toLowerCase() === profile.email.toLowerCase()
    )
    if (authUser) {
      const { error: authError } = await serviceClient.auth.admin.deleteUser(authUser.id)
      if (authError) {
        return NextResponse.json(
          { error: `Profiel verwijderd, maar login niet: ${authError.message}` },
          { status: 500 }
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
