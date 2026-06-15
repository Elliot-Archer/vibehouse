import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'

export async function POST(request: NextRequest) {
  // Allow only internal server calls (via CRON_SECRET) or admin users
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isInternalCall = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isInternalCall) {
    // Check if caller is admin
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== process.env.ADMIN_USER_ID) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }
  }

  const serviceSupabase = createSupabaseServiceClient()

  const body = await request.json()
  const { userId, title, body: msgBody, url } = body

  if (!userId || !title || !msgBody) {
    return NextResponse.json({ error: 'Ongeldige parameters' }, { status: 400 })
  }

  try {
    await sendPushToUser(serviceSupabase, userId, { title, body: msgBody, url })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 }
    )
  }
}
