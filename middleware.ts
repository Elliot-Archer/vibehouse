import { NextResponse, type NextRequest } from 'next/server'

// Hardcoded cookie name for this Supabase project
const COOKIE_NAME = 'sb-oqmhcbfxewpytmgmokhr-auth-token'

function hasValidSession(request: NextRequest): boolean {
  const raw = request.cookies.get(COOKIE_NAME)?.value
  if (!raw) return false

  try {
    const json = raw.startsWith('base64-')
      ? atob(raw.slice(7))
      : decodeURIComponent(raw)
    const session = JSON.parse(json)
    return typeof session.expires_at === 'number' && session.expires_at > Date.now() / 1000
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const protectedRoutes = ['/schema', '/ruilverzoeken', '/admin']
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))
  const loggedIn = hasValidSession(request)

  const response = loggedIn || !isProtected
    ? NextResponse.next()
    : NextResponse.redirect(new URL('/login', request.url))

  response.headers.set('x-middleware-ran', '1')
  response.headers.set('x-logged-in', String(loggedIn))
  response.headers.set('x-cookie-found', String(!!request.cookies.get(COOKIE_NAME)))

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
