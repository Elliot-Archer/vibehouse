'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestSwapAction, cancelSwapAction } from './actions'
import type { User } from '@/types'

interface SwapButtonProps {
  entryId: string
  requesterId: string
  housemates: User[]
  existingSwapId?: string
}

export default function SwapButton({
  entryId,
  requesterId: _requesterId,
  housemates,
  existingSwapId,
}: SwapButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleRequest(targetId: string, targetName: string) {
    setLoading(true)
    setError('')
    const result = await requestSwapAction(entryId, targetId)

    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      showToast(`✓ Ruilverzoek verstuurd naar ${targetName}!`)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleCancel() {
    if (!existingSwapId) return
    setCancelLoading(true)
    await cancelSwapAction(existingSwapId)
    setCancelLoading(false)
    router.refresh()
  }

  if (existingSwapId) {
    return (
      <button
        onClick={handleCancel}
        disabled={cancelLoading}
        className="text-xs text-orange-600 border border-orange-200 bg-orange-50 rounded-full px-3 py-1 hover:bg-orange-100 transition-colors disabled:opacity-50"
      >
        {cancelLoading ? '...' : 'Ruiling annuleren'}
      </button>
    )
  }

  return (
    <>
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-secondary-800 text-white text-sm font-medium px-5 py-3 rounded-full shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-xs px-3 py-1"
      >
        Ruilen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl w-full max-w-md p-6 pb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              Ruilverzoek sturen
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Kies een huisgenoot om mee te ruilen:
            </p>

            {error && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              {housemates.map((mate) => (
                <button
                  key={mate.id}
                  onClick={() => handleRequest(mate.id, mate.name)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-secondary-400 hover:bg-secondary-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-secondary-700 font-semibold text-sm flex-shrink-0">
                    {mate.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-800">
                    {loading ? 'Bezig...' : mate.name}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700 py-2"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </>
  )
}
