import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const protectedRoutes = ['/schema', '/ruilverzoeken', '/admin', '/strepen', '/meldingen', '/wachtwoord']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 365,
      },
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

  // getUser() ensures refresh tokens are exchanged and persisted in cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const loggedIn = !!user

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
  matcher: ['/schema/:path*', '/ruilverzoeken/:path*', '/admin/:path*', '/strepen/:path*', '/meldingen/:path*', '/wachtwoord/:path*', '/login'],
}
