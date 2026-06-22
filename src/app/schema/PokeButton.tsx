'use client'

import { useState, useTransition } from 'react'
import { pokeAction } from './actions'

interface PokeButtonProps {
  entryId: string
}

// Lets a user remind the owner of someone else's task to do it. After a
// successful poke it shows a brief confirmation instead of allowing spam.
export default function PokeButton({ entryId }: PokeButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function handleClick() {
    if (done || isPending) return
    setError('')
    startTransition(async () => {
      const result = await pokeAction(entryId)
      if (result.error) {
        setError(result.error)
      } else {
        setDone(true)
      }
    })
  }

  if (done) {
    return (
      <span className="text-xs text-secondary-600 border border-secondary-200 bg-secondary-50 rounded-full px-3 py-1 whitespace-nowrap">
        Gepord 👍
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title="Stuur een herinnering"
      className="text-xs px-3 py-1 rounded-full border border-secondary-200 text-secondary-700 hover:bg-secondary-50 transition-colors disabled:opacity-50 whitespace-nowrap"
    >
      {isPending ? '...' : error ? 'Mislukt' : '👉 Porren'}
    </button>
  )
}
