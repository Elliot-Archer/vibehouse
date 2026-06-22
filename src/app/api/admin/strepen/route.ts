import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { userId, delta } = await request.json()

  if (!userId || delta === undefined || typeof delta !== 'number') {
    return NextResponse.json(
      { error: 'userId en delta zijn verplicht' },
      { status: 400 }
    )
  }

  const serviceClient = createSupabaseServiceClient()

  // Get current strepen
  const { data: user, error: fetchError } = await serviceClient
    .from('users')
    .select('strepen, name')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    return NextResponse.json(
      { error: 'Gebruiker niet gevonden' },
      { status: 404 }
    )
  }

  const newStrepen = Math.max(0, (user.strepen ?? 0) + delta)

  const { error: updateError } = await serviceClient
    .from('users')
    .update({ strepen: newStrepen })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    )
  }

  // Notify the user when they receive a streep. A push failure must never
  // break the streep update itself.
  if (delta > 0) {
    try {
      await sendPushToUser(serviceClient, userId, {
        title: '➖ Je hebt een streep gekregen',
        body: `Je staat nu op ${newStrepen} stre${newStrepen === 1 ? 'ep' : 'pen'}.`,
        url: '/strepen',
      })
    } catch (e) {
      console.error('Push (strepen) failed:', e)
    }
  }

  return NextResponse.json({ strepen: newStrepen })
}
