'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      console.log('Login response:', res.status, data)

      if (!res.ok) {
        setError(data.error ?? 'Inloggen mislukt')
        setLoading(false)
        return
      }

      // Route handler has written session cookies — hard reload so middleware sees them
      console.log('Login successful, redirecting...')
      window.location.href = '/schema'
    } catch (err) {
      console.error('Login error:', err)
      setError('Er ging iets mis bij het inloggen')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-white rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl p-3">
            <img src="/logo.png" alt="Vibehouse" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white">Vibehouse</h1>
          <p className="text-primary-300 mt-2 text-sm font-medium">Schoonmaakrooster</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-white/20 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary-900 mb-1">
                E-mailadres
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="jij@voorbeeld.nl"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary-900 mb-1">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 text-secondary-900 rounded-lg py-3 text-sm font-bold hover:bg-primary-400 active:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Bezig met inloggen...' : 'Inloggen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
