'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { respondSwapAction } from './actions'

interface SwapResponseButtonsProps {
  swapId: string
  entryId: string
  requesterId: string
  currentUserId: string
}

export default function SwapResponseButtons({
  swapId,
  entryId: _entryId,
  requesterId: _requesterId,
  currentUserId: _currentUserId,
}: SwapResponseButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)

  async function handleAccept() {
    setLoading('accept')
    await respondSwapAction(swapId, true)
    setLoading(null)
    router.refresh()
  }

  async function handleDecline() {
    setLoading('decline')
    await respondSwapAction(swapId, false)
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={handleAccept}
        disabled={loading !== null}
        className="text-xs bg-green-500 text-white rounded-full px-3 py-1 hover:bg-green-600 transition-colors disabled:opacity-50"
      >
        {loading === 'accept' ? '...' : 'Accepteren'}
      </button>
      <button
        onClick={handleDecline}
        disabled={loading !== null}
        className="text-xs border border-slate-200 text-slate-600 rounded-full px-3 py-1 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {loading === 'decline' ? '...' : 'Afwijzen'}
      </button>
    </div>
  )
}
