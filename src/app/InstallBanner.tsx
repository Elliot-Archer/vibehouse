'use client'

import { useState, useEffect } from 'react'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    if (isStandalone) return
    if (localStorage.getItem('install-banner-dismissed')) return

    const ua = navigator.userAgent
    const onIos = /iPhone|iPad|iPod/.test(ua)
    const onMobile = onIos || /Android/.test(ua)

    if (onMobile) {
      setIsIos(onIos)
      setShow(true)
    }
  }, [])

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem('install-banner-dismissed', '1')
    setShow(false)
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-slate-800 text-white rounded-xl p-3 shadow-lg z-50 flex items-start gap-3">
      <div className="flex-1 text-sm leading-snug">
        {isIos ? (
          <p>
            Voeg de app toe aan je beginscherm zodat de URL-balk verdwijnt: tik op{' '}
            <strong>Delen</strong> en dan <strong>Zet op beginscherm</strong>.
          </p>
        ) : (
          <p>
            Installeer de app zodat de URL-balk verdwijnt: tik op{' '}
            <strong>⋮</strong> en dan <strong>App installeren</strong>.
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Sluiten"
        className="text-white/60 hover:text-white text-xl leading-none flex-shrink-0"
      >
        ×
      </button>
    </div>
  )
}
