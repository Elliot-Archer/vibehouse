'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markDoneAction } from './actions'

interface MarkDoneButtonProps {
  entryId: string
  currentStatus: 'pending' | 'done'
}

export default function MarkDoneButton({
  entryId,
  currentStatus,
}: MarkDoneButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  // Optimistic status: flips instantly on click, reconciled by the refresh.
  const [optimisticDone, setOptimisticDone] = useState(currentStatus === 'done')

  function handleClick() {
    if (optimisticDone || isPending) return
    setOptimisticDone(true)
    startTransition(async () => {
      const result = await markDoneAction(entryId)
      if (result.error) {
        setOptimisticDone(false)
      } else {
        router.refresh()
      }
    })
  }

  if (optimisticDone) {
    return (
      <span className="text-xs text-green-600 border border-green-200 bg-green-50 rounded-full px-3 py-1">
        Klaar ✓
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="btn-primary text-xs px-3 py-1"
    >
      {isPending ? '...' : 'Klaar melden'}
    </button>
  )
}
