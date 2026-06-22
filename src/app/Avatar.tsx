'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface AvatarProps {
  name: string
  src?: string | null
  /** Size/shape/border classes applied to the trigger and the image. */
  className?: string
  /** Background/text classes for the initial fallback. */
  fallbackClassName?: string
}

// A profile photo that opens a large, zoomed overlay when tapped. Works inside
// links/buttons: the click is stopped so it never triggers parent navigation.
export default function Avatar({
  name,
  src,
  className = 'w-10 h-10 rounded-xl',
  fallbackClassName = 'bg-secondary-100 text-secondary-600 border border-secondary-200',
}: AvatarProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
  }

  const initial = name.charAt(0).toUpperCase()

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Bekijk foto van ${name}`}
        className={`${className} overflow-hidden flex-shrink-0 cursor-zoom-in`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span
            className={`${fallbackClassName} w-full h-full flex items-center justify-center font-bold`}
          >
            {initial}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center p-6 cursor-zoom-out"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={name}
                onClick={(e) => e.stopPropagation()}
                className="max-w-[80vw] max-h-[70vh] rounded-2xl object-contain shadow-2xl cursor-default"
              />
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-48 h-48 rounded-3xl bg-secondary-700 text-white text-7xl font-bold flex items-center justify-center shadow-2xl cursor-default"
              >
                {initial}
              </div>
            )}
            <p className="mt-4 text-white text-lg font-semibold drop-shadow">{name}</p>
          </div>,
          document.body
        )}
    </>
  )
}
