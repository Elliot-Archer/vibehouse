import { cookies } from 'next/headers'

// Reads the Supabase session straight from the cookie — no network round-trip
// to the auth server (unlike supabase.auth.getUser()). The cookie holds the
// full session JSON including the user object, optionally base64-prefixed and
// optionally chunked across `.0`, `.1`, … suffixes.
const COOKIE_NAME = 'sb-oqmhcbfxewpytmgmokhr-auth-token'

interface SessionUser {
  id: string
  email: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()

  let raw = store.get(COOKIE_NAME)?.value
  if (!raw) {
    // Chunked cookie: join .0, .1, … in order
    const chunks: string[] = []
    for (let i = 0; i < 20; i++) {
      const chunk = store.get(`${COOKIE_NAME}.${i}`)?.value
      if (!chunk) break
      chunks.push(chunk)
    }
    if (chunks.length === 0) return null
    raw = chunks.join('')
  }

  try {
    const json = raw.startsWith('base64-')
      ? atob(raw.slice(7))
      : decodeURIComponent(raw)
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
