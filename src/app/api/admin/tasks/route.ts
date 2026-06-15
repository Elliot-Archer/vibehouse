import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { isAdminRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  void request
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const serviceClient = createSupabaseServiceClient()
  const { data, error } = await serviceClient.from('tasks').select('*').order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tasks: data })
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { name } = await request.json()

  if (!name) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()
  const { data, error } = await serviceClient
    .from('tasks')
    .insert({ name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data })
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Geen ID opgegeven' }, { status: 400 })
  }

  const serviceClient = createSupabaseServiceClient()
  const { error } = await serviceClient.from('tasks').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
