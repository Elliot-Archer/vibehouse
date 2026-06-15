'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface MarkDoneButtonProps {
  entryId: string
  currentStatus: 'pending' | 'done'
}

export default function MarkDoneButton({
  entryId,
  currentStatus,
}: MarkDoneButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const newStatus = currentStatus === 'done' ? 'pending' : 'done'

    const { error } = await supabase
      .from('schedule_entries')
      .update({ status: newStatus })
      .eq('id', entryId)

    if (!error) {
      router.refresh()
    }
    setLoading(false)
  }

  if (currentStatus === 'done') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs text-green-600 border border-green-200 bg-green-50 rounded-full px-3 py-1 hover:bg-green-100 transition-colors disabled:opacity-50"
      >
        {loading ? '...' : 'Klaar ✓'}
      </button>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-primary text-xs px-3 py-1"
    >
      {loading ? '...' : 'Klaar melden'}
    </button>
  )
}
