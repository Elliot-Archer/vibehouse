import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'
import { sendPushToUser } from '@/lib/push'
import { createNotifications } from '@/lib/notifications'

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

  // Notify the user when they receive a streep, and record it in their feed.
  // A push/notification failure must never break the streep update itself.
  if (delta > 0) {
    const strepenLabel = `${newStrepen} stre${newStrepen === 1 ? 'ep' : 'pen'}`
    try {
      await createNotifications(serviceClient, [
        {
          userId,
          direction: 'incoming',
          type: 'streep',
          actorId: null,
          body: `Je hebt een streep gekregen — je staat nu op ${strepenLabel}`,
          url: '/strepen',
        },
      ])
      await sendPushToUser(serviceClient, userId, {
        title: '➖ Je hebt een streep gekregen',
        body: `Je staat nu op ${strepenLabel}.`,
        url: '/strepen',
      })
    } catch (e) {
      console.error('Push (strepen) failed:', e)
    }
  }

  return NextResponse.json({ strepen: newStrepen })
}
