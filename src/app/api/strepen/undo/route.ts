import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'
import { getRequestProfile, notifyStreepEvent } from '@/lib/strepen'

// Admins can undo a streep. The log entry stays (marked as undone) so the
// house can still see what happened.
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const service = createSupabaseServiceClient()
  const admin = await getRequestProfile(service)
  if (!admin) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const logId = typeof body?.logId === 'string' ? body.logId : ''
  if (!logId) {
    return NextResponse.json({ error: 'logId is verplicht' }, { status: 400 })
  }

  // Only flips entries that aren't undone yet, so a double tap can't subtract twice.
  const undoneAt = new Date().toISOString()
  const { data: entry, error: undoError } = await service
    .from('streep_log')
    .update({ undone_at: undoneAt, undone_by: admin.id })
    .eq('id', logId)
    .is('undone_at', null)
    .select('id, user_id, reason')
    .maybeSingle()

  if (undoError) {
    return NextResponse.json({ error: undoError.message }, { status: 500 })
  }
  if (!entry) {
    return NextResponse.json(
      { error: 'Deze streep is al ongedaan gemaakt' },
      { status: 409 }
    )
  }

  const { data: recipient } = await service
    .from('users')
    .select('id, name, strepen')
    .eq('id', entry.user_id)
    .single()

  if (!recipient) {
    return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
  }

  const newCount = Math.max(0, (recipient.strepen ?? 0) - 1)
  const { error: updateError } = await service
    .from('users')
    .update({ strepen: newCount })
    .eq('id', recipient.id)

  if (updateError) {
    await service
      .from('streep_log')
      .update({ undone_at: null, undone_by: null })
      .eq('id', entry.id)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await notifyStreepEvent(service, {
    type: 'streep_undo',
    actor: admin,
    recipient,
    newCount,
    reason: entry.reason,
  })

  return NextResponse.json({
    strepen: newCount,
    userId: recipient.id,
    undone_at: undoneAt,
    undone_by: admin.id,
  })
}
