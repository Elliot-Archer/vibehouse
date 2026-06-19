'use client'

import { useEffect } from 'react'

export default function PushSubscriber() {
  useEffect(() => {
    // Only re-sync an EXISTING subscription to the database.
    // We never request permission automatically: iOS silently rejects
    // permission prompts that aren't triggered by a user gesture, which
    // left users with permission "granted" but no saved subscription.
    // First-time opt-in happens via the button on the profile page.
    async function syncExisting() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (Notification.permission !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      // Permission is granted but no live subscription exists — recreate it
      // so the user actually receives pushes (self-heal).
      if (!subscription) {
        const vapidKey =
          (window as unknown as { __VAPID_PUBLIC_KEY__?: string }).__VAPID_PUBLIC_KEY__
        if (!vapidKey) return
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
    }

    syncExisting().catch(console.error)
  }, [])

  return null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
