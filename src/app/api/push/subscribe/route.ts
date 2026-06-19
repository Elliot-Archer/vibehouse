import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'

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

  // Write with the service client: user_id stores the PROFILE id, but RLS
  // policies compare against auth.uid(), so the anon client is rejected.
  // The caller is already verified as authenticated above.
  const service = createSupabaseServiceClient()
  const { error } = await service.from('push_subscriptions').upsert(
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
