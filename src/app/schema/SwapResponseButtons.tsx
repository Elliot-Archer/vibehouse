'use client'

import { useState, useTransition } from 'react'
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
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<'accept' | 'decline' | null>(null)

  function respond(accept: boolean) {
    if (done || isPending) return
    setDone(accept ? 'accept' : 'decline') // instant feedback
    startTransition(async () => {
      await respondSwapAction(swapId, accept)
      router.refresh()
    })
  }

  if (done) {
    return (
      <p className="text-xs text-slate-500 mt-2">
        {done === 'accept' ? '✓ Geaccepteerd' : 'Afgewezen'}
      </p>
    )
  }

  return (
    <div className="flex gap-2 mt-2">
      <button
        onClick={() => respond(true)}
        className="text-xs bg-green-500 text-white rounded-full px-3 py-1 hover:bg-green-600 transition-colors"
      >
        Accepteren
      </button>
      <button
        onClick={() => respond(false)}
        className="text-xs border border-slate-200 text-slate-600 rounded-full px-3 py-1 hover:bg-slate-50 transition-colors"
      >
        Afwijzen
      </button>
    </div>
  )
}
