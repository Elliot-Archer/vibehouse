'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfileAction, updatePasswordAction } from './actions'
import { LogoutButton } from '../LogoutButton'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// Resize/compress an image file to a small square JPEG data URL.
function fileToResizedDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas niet beschikbaar'))
      // Cover-crop to square
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => reject(new Error('Kon afbeelding niet laden'))
    img.src = URL.createObjectURL(file)
  })
}

interface ProfileClientProps {
  initialName: string
  initialAvatarUrl: string | null
}

export default function ProfileClient({
  initialName,
  initialAvatarUrl,
}: ProfileClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile (nickname + avatar)
  const [nickname, setNickname] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl)
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')

  // Password
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState('')

  // Notifications
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown')
  const [notifLoading, setNotifLoading] = useState(false)
  // Whether a live push subscription is actually saved (not just permission granted)
  const [subscribed, setSubscribed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)
  const [notifError, setNotifError] = useState('')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifStatus('unsupported')
      return
    }

    // iOS only supports web push when the PWA is added to the home screen.
    const ua = window.navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua)
    setIsIOS(ios)
    const standalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)

    if (Notification.permission === 'denied') {
      setNotifStatus('denied')
      return
    }

    if (Notification.permission === 'granted') {
      setNotifStatus('granted')
      // Verify an actual subscription exists in the browser AND save it.
      // Permission "granted" alone does NOT mean the user receives pushes.
      ;(async () => {
        try {
          const registration = await navigator.serviceWorker.ready
          const existing = await registration.pushManager.getSubscription()
          if (existing) {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: existing.toJSON() }),
            })
            setSubscribed(true)
          }
        } catch { /* leave subscribed=false so the repair button shows */ }
      })()
    }
  }, [])

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProfileErr('')
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      setPendingAvatar(dataUrl)
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'Fout bij afbeelding')
    }
  }

  async function handleSaveProfile() {
    setProfileSaving(true)
    setProfileMsg('')
    setProfileErr('')
    const result = await updateProfileAction({
      nickname: nickname.trim() !== initialName ? nickname.trim() : undefined,
      avatarDataUrl: pendingAvatar ?? undefined,
    })
    if (result.error) {
      setProfileErr(result.error)
    } else {
      if (result.avatarUrl) setAvatarUrl(result.avatarUrl)
      setPendingAvatar(null)
      setProfileMsg('✓ Profiel opgeslagen')
      router.refresh()
    }
    setProfileSaving(false)
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (password !== confirm) { setPwError('Wachtwoorden komen niet overeen'); return }
    if (password.length < 8) { setPwError('Wachtwoord moet minimaal 8 tekens zijn'); return }
    setPwLoading(true)
    const result = await updatePasswordAction(password)
    if (result.error) { setPwError(result.error) } else { setPwSuccess(true) }
    setPwLoading(false)
  }

  async function handleEnableNotifications() {
    setNotifLoading(true)
    setNotifError('')
    try {
      // iOS requires the PWA installed to the home screen for web push.
      if (isIOS && !isStandalone) {
        setNotifError('Voeg de app eerst toe aan je beginscherm (zie hieronder), open hem daarna en probeer opnieuw.')
        setNotifLoading(false)
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotifStatus('denied')
        setNotifError('Toestemming geweigerd. Sta meldingen toe in je browserinstellingen.')
        setNotifLoading(false)
        return
      }
      setNotifStatus('granted')

      const vapidKey = (window as unknown as { __VAPID_PUBLIC_KEY__?: string }).__VAPID_PUBLIC_KEY__
      if (!vapidKey) {
        setNotifError('Serverconfiguratie ontbreekt (VAPID-sleutel). Neem contact op met de beheerder.')
        setNotifLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        })
      }
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setNotifError(`Opslaan mislukt: ${data.error ?? res.status}`)
        setNotifLoading(false)
        return
      }
      setSubscribed(true)
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : 'Onbekende fout bij inschakelen')
      console.error(e)
    }
    setNotifLoading(false)
  }

  const displayAvatar = pendingAvatar ?? avatarUrl
  const nameChanged = nickname.trim() !== initialName && nickname.trim() !== ''
  const canSaveProfile = (pendingAvatar !== null || nameChanged) && !profileSaving

  return (
    <div className="px-4 pt-6 pb-8 max-w-sm mx-auto w-full space-y-6">

      {/* Profiel: foto + bijnaam */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-3">Jouw profiel</h2>

        <div className="flex flex-col items-center mb-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group"
          >
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayAvatar}
                alt="Profielfoto"
                className="w-24 h-24 rounded-full object-cover border-2 border-secondary-200 shadow"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-secondary-100 flex items-center justify-center text-3xl font-bold text-secondary-600 border-2 border-secondary-200 shadow">
                {nickname.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 bg-primary-400 text-secondary-900 rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-md group-hover:bg-secondary-600 group-hover:text-white transition-colors">
              ✎
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Profielfoto uploaden"
            accept="image/png,image/jpeg,image/webp"
            onChange={handlePickFile}
            className="hidden"
          />
          <p className="text-xs text-slate-400 mt-2">Tik op de foto om te wijzigen</p>
        </div>

        <label className="block text-sm font-medium text-slate-700 mb-1">Bijnaam</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={30}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500"
          placeholder="Je naam in de app"
        />

        {profileErr && <p className="text-red-600 text-sm mt-2">{profileErr}</p>}
        {profileMsg && <p className="text-green-700 text-sm mt-2">{profileMsg}</p>}

        <button
          onClick={handleSaveProfile}
          disabled={!canSaveProfile}
          className="mt-3 w-full bg-primary-400 text-secondary-900 rounded-lg py-2.5 text-sm font-bold hover:bg-secondary-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {profileSaving ? 'Bezig...' : 'Profiel opslaan'}
        </button>
      </div>

      {/* Meldingen */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-1">Meldingen</h2>
        <p className="text-xs text-slate-500 mb-3">
          Ontvang een herinnering elke maandag voor je schoonmaaktaak.
        </p>
        {notifStatus === 'unsupported' ? (
          <p className="text-xs text-slate-400">
            Niet ondersteund in deze browser. Op iPhone: open de app via Safari en voeg hem toe aan je beginscherm.
          </p>
        ) : notifStatus === 'denied' ? (
          <p className="text-xs text-red-600">
            Meldingen zijn geblokkeerd. Zet ze aan via Instellingen → Tjokkellust → Meldingen (iOS) of via je browserinstellingen.
          </p>
        ) : subscribed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <span>✓</span><span>Meldingen ingeschakeld</span>
            </div>
            <button
              onClick={handleEnableNotifications}
              disabled={notifLoading}
              className="text-xs text-slate-400 underline disabled:opacity-50"
            >
              {notifLoading ? 'Bezig...' : 'Opnieuw aanmelden'}
            </button>
          </div>
        ) : (
          <>
            {/* iOS users must install the PWA before push works at all */}
            {isIOS && !isStandalone && (
              <div className="mb-3 bg-secondary-50 border border-secondary-200 rounded-lg p-3 text-xs text-secondary-800 space-y-1">
                <p className="font-semibold">📲 iPhone? Eerst toevoegen aan beginscherm:</p>
                <p>1. Tik op het deel-icoon (vierkant met pijl) in Safari</p>
                <p>2. Kies &ldquo;Zet op beginscherm&rdquo;</p>
                <p>3. Open de app vanaf je beginscherm en kom hier terug</p>
              </div>
            )}
            <button
              onClick={handleEnableNotifications}
              disabled={notifLoading}
              className="w-full bg-primary-400 text-secondary-900 rounded-lg py-2.5 text-sm font-bold hover:bg-secondary-600 hover:text-white transition-colors disabled:opacity-50"
            >
              {notifLoading ? 'Bezig...' : '🔔 Meldingen inschakelen'}
            </button>
          </>
        )}
        {notifError && <p className="text-xs text-red-600 mt-2">{notifError}</p>}
      </div>

      {/* Wachtwoord */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-3">Wachtwoord wijzigen</h2>
        {pwSuccess ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-700 font-medium">✓ Wachtwoord gewijzigd!</p>
          </div>
        ) : (
          <form onSubmit={handlePassword} className="space-y-3">
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
            {pwError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{pwError}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={pwLoading}
              className="w-full bg-primary-400 text-secondary-900 rounded-lg py-2.5 text-sm font-bold hover:bg-secondary-600 hover:text-white transition-colors disabled:opacity-50"
            >
              {pwLoading ? 'Bezig...' : 'Wachtwoord opslaan'}
            </button>
          </form>
        )}
      </div>

      <div className="pt-2">
        <LogoutButton variant="profile" />
      </div>

    </div>
  )
}
