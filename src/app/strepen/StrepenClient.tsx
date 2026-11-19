'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { User } from '@/types'
import type { StreepLogEntry } from '@/lib/strepen'
import Avatar from '../Avatar'

const REASON_MAX = 200

interface StrepenClientProps {
  users: User[]
  isAdmin: boolean
  log: StreepLogEntry[]
  logAvailable: boolean
}

export default function StrepenClient({
  users,
  isAdmin,
  log: initialLog,
  logAvailable,
}: StrepenClientProps) {
  const [userList, setUserList] = useState(users)
  const [log, setLog] = useState(initialLog)
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  // Reason dialog
  const [target, setTarget] = useState<User | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const nameById = new Map(userList.map((u) => [u.id, u.name]))
  const nameOf = (id: string | null) => (id && nameById.get(id)) || 'Onbekend'

  function flash(text: string) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2500)
  }

  function setCount(userId: string, strepen: number) {
    setUserList((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, strepen } : u))
    )
  }

  function openDialog(user: User) {
    setTarget(user)
    setReason('')
    setReasonError('')
  }

  function closeDialog() {
    if (submitting) return
    setTarget(null)
  }

  async function giveStreep() {
    if (!target) return
    const trimmed = reason.trim()
    if (!trimmed) {
      setReasonError('Zonder reden geen streep.')
      return
    }

    setSubmitting(true)
    setReasonError('')
    try {
      const res = await fetch('/api/strepen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: target.id, reason: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReasonError(data.error || 'Er ging iets mis')
        setSubmitting(false)
        return
      }
      setCount(target.id, data.strepen)
      setLog((prev) => [data.entry as StreepLogEntry, ...prev])
      setSubmitting(false)
      setTarget(null)
      flash(`✓ Streep gegeven aan ${target.name}`)
    } catch {
      setReasonError('Netwerkfout')
      setSubmitting(false)
    }
  }

  async function undoStreep(entry: StreepLogEntry) {
    if (!confirm(`Streep van ${nameOf(entry.user_id)} ongedaan maken?\n“${entry.reason}”`)) return
    setLoading(entry.id)
    setMessage('')
    try {
      const res = await fetch('/api/strepen/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId: entry.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        flash(`❌ ${data.error || 'Fout bij ongedaan maken'}`)
      } else {
        setCount(data.userId, data.strepen)
        setLog((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, undone_at: data.undone_at, undone_by: data.undone_by }
              : e
          )
        )
        flash('✓ Ongedaan gemaakt')
      }
    } catch {
      flash('❌ Netwerkfout')
    }
    setLoading(null)
  }

  // Admin-only correction for strepen given before the log existed.
  async function lowerCount(user: User) {
    if (!confirm(`Teller van ${user.name} met 1 verlagen? Dit komt niet in het logboek.`)) return
    setLoading(user.id)
    setMessage('')
    try {
      const res = await fetch('/api/admin/strepen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, delta: -1 }),
      })
      const data = await res.json()
      if (!res.ok) {
        flash(`❌ ${data.error || 'Fout bij updaten'}`)
      } else {
        setCount(user.id, data.strepen)
        flash('✓ Bijgewerkt')
      }
    } catch {
      flash('❌ Netwerkfout')
    }
    setLoading(null)
  }

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

      {!logAvailable && (
        <div className="card text-sm text-slate-500 text-center">
          Strepen uitdelen kan binnenkort weer, met reden erbij.
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
              <p className="font-medium text-slate-900 text-sm truncate">{user.name}</p>
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

              <div className="flex gap-1">
                {isAdmin && (
                  <button
                    onClick={() => lowerCount(user)}
                    disabled={loading === user.id || (user.strepen ?? 0) === 0}
                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm disabled:opacity-50 transition-colors"
                    title="Teller verlagen (zonder log)"
                  >
                    −
                  </button>
                )}
                {logAvailable && (
                  <button
                    onClick={() => openDialog(user)}
                    className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-700 font-medium text-sm transition-colors"
                    title="Streep geven"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {logAvailable && (
        <section className="pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Logboek
          </h2>
          {log.length === 0 ? (
            <p className="text-sm text-slate-400">Nog geen strepen uitgedeeld.</p>
          ) : (
            <ul className="space-y-2">
              {log.map((entry) => {
                const undone = !!entry.undone_at
                return (
                  <li key={entry.id} className="card !p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`min-w-0 ${undone ? 'opacity-50' : ''}`}>
                        <p className={`text-sm text-slate-800 ${undone ? 'line-through' : ''}`}>
                          <span className="font-semibold">{nameOf(entry.giver_id)}</span>
                          {' → '}
                          <span className="font-semibold">{nameOf(entry.user_id)}</span>
                        </p>
                        <p className={`text-sm text-slate-600 break-words ${undone ? 'line-through' : ''}`}>
                          “{entry.reason}”
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(entry.created_at), {
                            addSuffix: true,
                            locale: nl,
                          })}
                          {undone && ` · ongedaan door ${nameOf(entry.undone_by)}`}
                        </p>
                      </div>
                      {isAdmin && !undone && (
                        <button
                          onClick={() => undoStreep(entry)}
                          disabled={loading === entry.id}
                          className="text-xs font-medium text-slate-500 hover:text-red-600 underline flex-shrink-0 disabled:opacity-50"
                        >
                          ongedaan maken
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {target && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={closeDialog}
        >
          <form
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              giveStreep()
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Streep voor {target.name}
            </p>
            <label htmlFor="streep-reden" className="block text-lg font-bold text-slate-900">
              Ey geef die reden ff dan
            </label>
            <textarea
              id="streep-reden"
              autoFocus
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (reasonError) setReasonError('')
              }}
              className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              placeholder="Waarom krijgt die een streep?"
            />
            <div className="flex justify-between items-center text-xs">
              <span className="text-red-600">{reasonError}</span>
              <span className="text-slate-400">
                {reason.length}/{REASON_MAX}
              </span>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeDialog} className="btn-ghost" disabled={submitting}>
                Laat maar
              </button>
              <button
                type="submit"
                className="btn-danger disabled:opacity-50"
                disabled={submitting || !reason.trim()}
              >
                {submitting ? 'Bezig…' : 'Geef streep'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
