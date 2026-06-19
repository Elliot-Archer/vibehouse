import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'

export async function POST(request: NextRequest) {
  // Allow internal server calls (via CRON_SECRET) or admin users.
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isInternalCall = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isInternalCall) {
    const session = await getSessionUser()
    const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').filter(Boolean)
    if (!session || !adminIds.includes(session.id)) {
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
    const count = await sendPushToUser(serviceSupabase, userId, { title, body: msgBody, url })
    return NextResponse.json({ ok: true, count })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 }
    )
  }
}
