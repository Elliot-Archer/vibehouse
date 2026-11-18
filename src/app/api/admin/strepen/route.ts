import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'

// Admin-only correction: lowers someone's count by one without touching the
// log. Meant for old strepen that were given before the log existed; strepen
// with a log entry are undone via /api/strepen/undo instead. Giving strepen
// goes through /api/strepen (with a reason).
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { userId, delta } = await request.json()

  if (!userId || delta !== -1) {
    return NextResponse.json(
      { error: 'userId is verplicht en delta moet -1 zijn' },
      { status: 400 }
    )
  }

  const serviceClient = createSupabaseServiceClient()

  const { data: user, error: fetchError } = await serviceClient
    .from('users')
    .select('strepen')
    .eq('id', userId)
    .single()

  if (fetchError || !user) {
    return NextResponse.json(
      { error: 'Gebruiker niet gevonden' },
      { status: 404 }
    )
  }

  const newStrepen = Math.max(0, (user.strepen ?? 0) - 1)

  const { error: updateError } = await serviceClient
    .from('users')
    .update({ strepen: newStrepen })
    .eq('id', userId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ strepen: newStrepen })
}
