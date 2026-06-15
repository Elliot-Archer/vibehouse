import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const protectedRoutes = ['/schema', '/ruilverzoeken', '/admin']
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route))

  // Check for session via the access token cookie set after login
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(
    (c) => c.name.includes('auth-token') || c.name === 'sb-access-token'
  )

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/schema'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json|sw\\.js).*)',
  ],
}
