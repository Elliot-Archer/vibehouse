import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { sendPushToUser } from '@/lib/push'

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServiceClient()

  const body = await request.json()
  const { userId, title, body: msgBody, url } = body

  if (!userId || !title || !msgBody) {
    return NextResponse.json({ error: 'Ongeldige parameters' }, { status: 400 })
  }

  try {
    await sendPushToUser(supabase, userId, { title, body: msgBody, url })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 }
    )
  }
}
