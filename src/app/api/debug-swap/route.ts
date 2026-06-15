import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not authed' })

  const { data: profile, error: profileError } = await supabase
    .from('users').select('id,name,email').eq('email', user.email).single()

  const { data: entries } = await supabase
    .from('schedule_entries').select('id,user_id,week').eq('week', '2026-06-15')

  // Try a test insert
  const testInsert = await supabase.from('swap_requests').insert({
    requester_id: profile?.id,
    target_id: '5eee64f6-e74a-4d43-b524-8d293d946f13',
    entry_id: entries?.[0]?.id,
    status: 'pending'
  })

  return NextResponse.json({
    authUserId: user.id,
    profile,
    profileError: profileError?.message,
    entries,
    insertError: testInsert.error?.message,
    insertData: testInsert.data
  })
}
