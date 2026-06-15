import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('email', authUser.email)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
  }

  const body = await request.json()
  const { subscription } = body

  if (!subscription) {
    return NextResponse.json({ error: 'Geen subscription opgegeven' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: profile.id,
      subscription,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  })
}
