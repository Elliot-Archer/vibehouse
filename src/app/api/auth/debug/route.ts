import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const allCookies = request.cookies.getAll()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => allCookies,
        setAll: () => {},
      },
    }
  )

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  return NextResponse.json({
    cookieNames: allCookies.map(c => c.name),
    session: session ? { email: session.user.email, expires_at: session.expires_at } : null,
    sessionError: sessionError?.message,
    user: user ? { email: user.email, id: user.id } : null,
    userError: userError?.message,
  })
}
