'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function WachtwoordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [notifLoading, setNotifLoading] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotifStatus('unsupported')
    } else if (Notification.permission === 'granted') {
      setNotifStatus('granted')
    } else if (Notification.permission === 'denied') {
      setNotifStatus('denied')
    }
  }, [])

  async function handleEnableNotifications() {
    setNotifLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifStatus('denied')
        setNotifLoading(false)
        return
      }
      setNotifStatus('granted')

      const registration = await navigator.serviceWorker.ready
      const vapidKey = (window as unknown as { __VAPID_PUBLIC_KEY__?: string }).__VAPID_PUBLIC_KEY__
      if (!vapidKey) { setNotifLoading(false); return }

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        })
      }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
    } catch (e) {
      console.error(e)
    }
    setNotifLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Wachtwoorden komen niet overeen'); return }
    if (password.length < 8) { setError('Wachtwoord moet minimaal 8 tekens zijn'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message) } else { setSuccess(true) }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="bg-gradient-to-r from-secondary-900 to-secondary-800 px-4 pt-12 pb-6 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Tjokkellust" className="w-14 h-14 object-contain drop-shadow-lg" />
          <div>
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest">Profiel</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Tjokkellust</h1>
          </div>
        </div>
      </header>

      <div className="px-4 pt-6 pb-8 max-w-sm mx-auto w-full space-y-6">

        {/* Notificaties */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-1">Meldingen</h2>
          <p className="text-xs text-slate-500 mb-3">
            Ontvang een herinnering elke maandag voor je schoonmaaktaak.
          </p>
          {notifStatus === 'unsupported' && (
            <p className="text-xs text-slate-400">Niet ondersteund in deze browser. Voeg de app toe aan je thuisscherm op iOS.</p>
          )}
          {notifStatus === 'granted' && (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <span>✓</span><span>Meldingen ingeschakeld</span>
            </div>
          )}
          {notifStatus === 'denied' && (
            <p className="text-xs text-red-600">Meldingen zijn geblokkeerd. Pas dit aan in je browserinstellingen.</p>
          )}
          {notifStatus === 'unknown' && (
            <button
              onClick={handleEnableNotifications}
              disabled={notifLoading}
              className="w-full bg-primary-400 text-secondary-900 rounded-lg py-2.5 text-sm font-bold hover:bg-secondary-600 hover:text-white transition-colors disabled:opacity-50"
            >
              {notifLoading ? 'Bezig...' : '🔔 Meldingen inschakelen'}
            </button>
          )}
        </div>

        {/* Wachtwoord */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-3">Wachtwoord wijzigen</h2>
          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-medium">✓ Wachtwoord gewijzigd!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nieuw wachtwoord</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Bevestig wachtwoord</label>
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
                className="w-full bg-primary-400 text-secondary-900 rounded-lg py-2.5 text-sm font-bold hover:bg-secondary-600 hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Bezig...' : 'Wachtwoord opslaan'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
