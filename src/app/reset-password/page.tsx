import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const createClient = async () => {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: { message: string; code: string }
}) {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect('/')
  }

  const handleResetPassword = async (formData: FormData) => {
    'use server'

    const password = formData.get('password') as string
    const passwordConfirm = formData.get('passwordConfirm') as string
    const supabase = await createClient()

    if (password !== passwordConfirm) {
      return redirect(
        `/reset-password?code=${searchParams.code}&message=Passwords do not match`
      )
    }

    if (searchParams.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(
        searchParams.code
      )

      if (error) {
        return redirect(
          `/reset-password?message=Unable to reset password. Please try again.`
        )
      }
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      return redirect(
        `/reset-password?message=Unable to reset password. Please try again.`
      )
    }

    redirect('/login?message=Your password has been reset successfully.')
  }

  const handleSendResetLink = async (formData: FormData) => {
    'use server'

    const email = formData.get('email') as string
    const supabase = await createClient()

    // Determine the base URL - use localhost:3004 for local dev
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004'
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    })

    if (error) {
      console.error('Password reset error:', error)
      return redirect(
        `/reset-password?message=${encodeURIComponent(error.message || 'Could not send reset email. Please try again.')}`
      )
    }

    redirect(
      '/reset-password?message=Password reset link has been sent to your email address.'
    )
  }

  if (searchParams.code) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-white rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl p-3">
              <img src="/logo.png" alt="Tjokkellust" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold text-white">Nieuw Wachtwoord</h1>
            <p className="text-primary-300 mt-2 text-sm font-medium">Voer je nieuwe wachtwoord in</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl border border-white/20 p-6">
            <form action={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary-900 mb-1">
                  Nieuw Wachtwoord
                </label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-secondary-900 mb-1">
                  Bevestig Wachtwoord
                </label>
                <input
                  id="passwordConfirm"
                  type="password"
                  name="passwordConfirm"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              {searchParams?.message && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{searchParams.message}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-primary-500 text-secondary-900 rounded-lg py-3 text-sm font-bold hover:bg-primary-400 active:bg-primary-600 transition-colors shadow-lg"
              >
                Wachtwoord Instellen
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-white rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl p-3">
            <img src="/logo.png" alt="Tjokkellust" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white">Wachtwoord Vergeten</h1>
          <p className="text-primary-300 mt-2 text-sm font-medium">We sturen je een reset link</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-white/20 p-6">
          <form action={handleSendResetLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary-900 mb-1">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="jij@voorbeeld.nl"
              />
            </div>

            {searchParams?.message && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-700 text-sm">{searchParams.message}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-primary-500 text-secondary-900 rounded-lg py-3 text-sm font-bold hover:bg-primary-400 active:bg-primary-600 transition-colors shadow-lg"
            >
              Verstuur Reset Link
            </button>
            <div className="text-center mt-4">
              <a href="/login" className="text-sm text-white hover:underline">
                Terug naar inloggen
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
