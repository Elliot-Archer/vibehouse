import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const COOKIE_NAME = 'sb-oqmhcbfxewpytmgmokhr-auth-token'
const protectedRoutes = ['/schema', '/ruilverzoeken', '/admin', '/strepen', '/meldingen', '/wachtwoord']

// Refresh the access token this many seconds before it actually expires.
const REFRESH_WINDOW = 300

// Reads the session cookie locally (no network) to learn whether a session
// exists and when its access token expires. Mirrors src/lib/session.ts.
function readSessionCookie(request: NextRequest): { hasCookie: boolean; expiresAt: number | null } {
  let raw = request.cookies.get(COOKIE_NAME)?.value
  if (!raw) {
    const chunks: string[] = []
    for (let i = 0; i < 20; i++) {
      const chunk = request.cookies.get(`${COOKIE_NAME}.${i}`)?.value
      if (!chunk) break
      chunks.push(chunk)
    }
    if (chunks.length === 0) return { hasCookie: false, expiresAt: null }
    raw = chunks.join('')
  }
  try {
    const json = raw.startsWith('base64-') ? atob(raw.slice(7)) : decodeURIComponent(raw)
    const session = JSON.parse(json)
    const expiresAt = typeof session.expires_at === 'number' ? session.expires_at : null
    return { hasCookie: true, expiresAt }
  } catch {
    return { hasCookie: true, expiresAt: null }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { hasCookie, expiresAt } = readSessionCookie(request)

  const now = Date.now() / 1000
  const expired = expiresAt == null || expiresAt < now
  const nearExpiry = expiresAt != null && expiresAt - now < REFRESH_WINDOW

  let response = NextResponse.next({ request })
  let loggedIn = hasCookie && !expired

  // Only hit the auth server when a refresh is actually needed: an expired or
  // soon-to-expire token. Fresh tokens (the common case, including every server
  // action) pass through with no network round-trip.
  if (hasCookie && (expired || nearExpiry)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (
            cookiesToSet: { name: string; value: string; options?: object }[]
          ) => {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            response = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(
                name,
                value,
                options as Parameters<typeof response.cookies.set>[2]
              )
            )
          },
        },
      }
    )
    // getUser() refreshes from the refresh token when the access token has
    // expired, writing the new cookies via setAll above.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    loggedIn = !!user
  }

  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))

  if (!loggedIn && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (loggedIn && pathname === '/login') {
    return NextResponse.redirect(new URL('/schema', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js).*)',
  ],
}
