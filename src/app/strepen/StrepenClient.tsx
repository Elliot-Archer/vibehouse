'use client'

import { useState } from 'react'
import type { User } from '@/types'
import Avatar from '../Avatar'

interface StrepenClientProps {
  users: User[]
  isAdmin: boolean
}

export default function StrepenClient({ users, isAdmin }: StrepenClientProps) {
  const [userList, setUserList] = useState(users)
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function updateStrepen(userId: string, delta: number) {
    setLoading(userId)
    setMessage('')

    try {
      const res = await fetch('/api/admin/strepen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, delta }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessage(`❌ ${data.error || 'Fout bij updaten'}`)
        setLoading(null)
        return
      }

      // Update local state
      setUserList((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, strepen: data.strepen } : u
        )
      )
      setMessage('✓ Bijgewerkt')
      setTimeout(() => setMessage(''), 2000)
    } catch (err) {
      setMessage('❌ Netwerkfout')
    }

    setLoading(null)
  }

  // Sort by strepen (descending) and then by name
  const sorted = [...userList].sort((a, b) => {
    const bs = b.strepen ?? 0
    const as = a.strepen ?? 0
    if (bs !== as) return bs - as
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="px-4 pt-6 pb-8 max-w-sm mx-auto w-full space-y-4">
      {message && (
        <div className="text-center text-sm font-medium text-slate-700">
          {message}
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((user) => (
          <div
            key={user.id}
            className="card flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar
                name={user.name}
                src={user.avatar_url}
                className="w-10 h-10 rounded-full"
                fallbackClassName="bg-secondary-100 text-secondary-600 text-sm"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm">{user.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className={`text-2xl font-bold ${
                  (user.strepen ?? 0) > 3
                    ? 'text-red-600'
                    : (user.strepen ?? 0) > 0
                      ? 'text-orange-600'
                      : 'text-slate-400'
                }`}
              >
                {user.strepen ?? 0}
              </div>

              {isAdmin && (
                <div className="flex gap-1">
                  <button
                    onClick={() => updateStrepen(user.id, -1)}
                    disabled={loading === user.id}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm disabled:opacity-50 transition-colors"
                    title="Streep verminderen"
                  >
                    −
                  </button>
                  <button
                    onClick={() => updateStrepen(user.id, 1)}
                    disabled={loading === user.id}
                    className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 font-medium text-sm disabled:opacity-50 transition-colors"
                    title="Streep toevoegen"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
