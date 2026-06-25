import { cookies } from 'next/headers'

// Reads the Supabase session straight from the cookie — no network round-trip
// to the auth server (unlike supabase.auth.getUser()). The cookie holds the
// full session JSON including the user object, optionally base64-prefixed and
// optionally chunked across `.0`, `.1`, … suffixes.
function getCookieBaseName(cookieNames: string[]): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (supabaseUrl) {
    try {
      const hostname = new URL(supabaseUrl).hostname
      const projectRef = hostname.split('.')[0]
      const expected = `sb-${projectRef}-auth-token`

      if (cookieNames.some((name) => name === expected || name.startsWith(`${expected}.`))) {
        return expected
      }
    } catch {
      // Ignore malformed URL and fall back to discovery.
    }
  }

  const discovered = cookieNames.find((name) => /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name))
  if (!discovered) return null
  return discovered.replace(/\.\d+$/, '')
}

function decodeCookiePayload(raw: string): string {
  const base = raw.startsWith('base64-') ? atob(raw.slice(7)) : raw
  try {
    return decodeURIComponent(base)
  } catch {
    return base
  }
}

interface SessionUser {
  id: string
  email: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const allCookies = store.getAll()
  const cookieName = getCookieBaseName(allCookies.map((cookie) => cookie.name))
  if (!cookieName) return null

  let raw = store.get(cookieName)?.value
  if (!raw) {
    // Chunked cookie: join .0, .1, … in order
    const chunks: string[] = []
    for (let i = 0; i < 20; i++) {
      const chunk = store.get(`${cookieName}.${i}`)?.value
      if (!chunk) break
      chunks.push(chunk)
    }
    if (chunks.length === 0) return null
    raw = chunks.join('')
  }

  try {
    const json = decodeCookiePayload(raw)
    const session = JSON.parse(json)

    if (
      typeof session.expires_at === 'number' &&
      session.expires_at < Date.now() / 1000
    ) {
      return null
    }

    const user = session.user
    if (!user?.email) return null
    return { id: user.id, email: user.email }
  } catch {
    return null
  }
}
