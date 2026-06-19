import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'

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
    .select('strepen')
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

  return NextResponse.json({ strepen: newStrepen })
}
