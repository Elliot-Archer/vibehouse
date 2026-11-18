import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { getRequestProfile, notifyStreepEvent, STREEP_REASON_MAX } from '@/lib/strepen'

// Any housemate can give a streep, as long as they say why.
export async function POST(request: NextRequest) {
  const service = createSupabaseServiceClient()
  const giver = await getRequestProfile(service)
  if (!giver) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (!userId) {
    return NextResponse.json({ error: 'Kies wie de streep krijgt' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: 'Ey geef die reden ff dan' }, { status: 400 })
  }
  if (reason.length > STREEP_REASON_MAX) {
    return NextResponse.json(
      { error: `Reden mag maximaal ${STREEP_REASON_MAX} tekens zijn` },
      { status: 400 }
    )
  }

  const { data: recipient } = await service
    .from('users')
    .select('id, name, strepen')
    .eq('id', userId)
    .single()

  if (!recipient) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
  }

  // Log first: if the log can't be written (e.g. the table doesn't exist yet),
  // no streep is given at all, so there are never strepen without a reason.
  const { data: entry, error: logError } = await service
    .from('streep_log')
    .insert({ user_id: recipient.id, giver_id: giver.id, reason })
    .select('id, user_id, giver_id, reason, created_at, undone_at, undone_by')
    .single()

  if (logError || !entry) {
    console.error('streep_log insert failed:', logError?.message)
    return NextResponse.json(
      { error: 'Streep kon niet worden opgeslagen' },
      { status: 500 }
    )
  }

  const newCount = (recipient.strepen ?? 0) + 1
  const { error: updateError } = await service
    .from('users')
    .update({ strepen: newCount })
    .eq('id', recipient.id)

  if (updateError) {
    // Roll back the log entry so log and counter stay in sync.
    await service.from('streep_log').delete().eq('id', entry.id)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await notifyStreepEvent(service, {
    type: 'streep',
    actor: giver,
    recipient,
    newCount,
    reason,
  })

  return NextResponse.json({ strepen: newCount, entry })
}
