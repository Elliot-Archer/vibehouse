import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'
import { getSessionUser } from '@/lib/session'
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
    try {
      const session = await getSessionUser()
      let distributorId: string | null = null
      let distributorName = 'Een huisgenoot'

      if (session?.email) {
        const { data: distributor } = await serviceClient
          .from('users')
          .select('id, name')
          .eq('email', session.email)
          .single()

        if (distributor?.id) distributorId = distributor.id
        if (distributor?.name) distributorName = distributor.name
      }

      const { data: allUsers } = await serviceClient
        .from('users')
        .select('id')

      const recipientBody = `${distributorName} heeft je een streep gegeven. Je staat nu op ${newStrepen}`
      const othersBody = `${distributorName} heeft ${user.name} een streep gegeven. ${user.name} staat nu op ${newStrepen}`

      await createNotifications(
        serviceClient,
        (allUsers || []).map((u: { id: string }) => ({
          userId: u.id,
          direction: 'incoming' as const,
          type: 'streep' as const,
          actorId: distributorId,
          body: u.id === userId ? recipientBody : othersBody,
          url: '/strepen',
        }))
      )

      await sendPushToUser(serviceClient, userId, {
        title: '➖ Je hebt een streep gekregen',
        body: recipientBody,
        url: '/strepen',
      })
    } catch (e) {
      console.error('Push (strepen) failed:', e)
    }
  }

  return NextResponse.json({ strepen: newStrepen })
}
