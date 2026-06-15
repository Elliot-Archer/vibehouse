'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function WachtwoordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Wachtwoorden komen niet overeen')
      return
    }
    if (password.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens zijn')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <div className="px-4 pt-12 pb-8 max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <img src="/logo.png" alt="Tjokkellust" className="w-12 h-12 object-contain drop-shadow" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Tjokkellust</h1>
          <p className="text-sm text-slate-500">Wachtwoord wijzigen</p>
        </div>
      </div>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-700 font-medium">✓ Wachtwoord gewijzigd!</p>
          <a href="/schema" className="text-sm text-secondary-600 hover:underline mt-2 inline-block">
            Terug naar schema
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nieuw wachtwoord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
              placeholder="Minimaal 8 tekens"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bevestig wachtwoord
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
              placeholder="Herhaal wachtwoord"
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
            className="w-full bg-primary-400 text-secondary-900 rounded-lg py-3 text-sm font-bold hover:bg-secondary-600 hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Bezig...' : 'Wachtwoord opslaan'}
          </button>
        </form>
      )}
    </div>
  )
}
