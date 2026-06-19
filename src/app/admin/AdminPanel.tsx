'use client'

import { useState } from 'react'
import type { User, Task, TaskMember } from '@/types'

interface AdminPanelProps {
  initialUsers: User[]
  initialTasks: Task[]
  initialTaskMembers: TaskMember[]
  subscribedUserIds: string[]
}

export default function AdminPanel({
  initialUsers,
  initialTasks,
  initialTaskMembers,
  subscribedUserIds,
}: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [taskMembers, setTaskMembers] = useState<TaskMember[]>(initialTaskMembers)
  const [activeTab, setActiveTab] = useState<'users' | 'tasks' | 'members' | 'schema' | 'push'>('users')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Push notification testing
  const [pushLoading, setPushLoading] = useState(false)
  const [testingUserId, setTestingUserId] = useState<string | null>(null)
  const subscribedSet = new Set(subscribedUserIds)

  // User management
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [userLoading, setUserLoading] = useState(false)

  // Task management
  const [newTaskName, setNewTaskName] = useState('')
  const [taskLoading, setTaskLoading] = useState(false)

  // Task members
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [membersLoading, setMembersLoading] = useState(false)

  // Delete loading guards
  const [removingUserId, setRemovingUserId] = useState<string | null>(null)
  const [removingTaskId, setRemovingTaskId] = useState<string | null>(null)

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setUserLoading(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newUserName, email: newUserEmail, password: newUserPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fout bij aanmaken')
      setUsers((prev) => [...prev, data.user])
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPassword('')
      showMessage('success', 'Gebruiker aangemaakt')
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Onbekende fout')
    }
    setUserLoading(false)
  }

  async function removeUser(userId: string) {
    if (!confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) return
    if (removingUserId) return
    setRemovingUserId(userId)
    const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      showMessage('success', 'Gebruiker verwijderd')
    } else {
      showMessage('error', 'Fout bij verwijderen')
    }
    setRemovingUserId(null)
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    setTaskLoading(true)
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTaskName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fout bij aanmaken')
      setTasks((prev) => [...prev, data.task])
      setNewTaskName('')
      showMessage('success', 'Taak aangemaakt')
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Onbekende fout')
    }
    setTaskLoading(false)
  }

  async function removeTask(taskId: string) {
    if (!confirm('Weet je zeker dat je deze taak wilt verwijderen?')) return
    if (removingTaskId) return
    setRemovingTaskId(taskId)
    const res = await fetch(`/api/admin/tasks?id=${taskId}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      setTaskMembers((prev) => prev.filter((m) => m.task_id !== taskId))
      showMessage('success', 'Taak verwijderd')
    } else {
      showMessage('error', 'Fout bij verwijderen')
    }
    setRemovingTaskId(null)
  }

  function getMembersForTask(taskId: string): TaskMember[] {
    return taskMembers
      .filter((m) => m.task_id === taskId)
      .sort((a, b) => a.order - b.order)
  }

  async function toggleMember(taskId: string, userId: string) {
    const current = getMembersForTask(taskId)
    const exists = current.find((m) => m.user_id === userId)
    let updated: TaskMember[]
    if (exists) {
      updated = current.filter((m) => m.user_id !== userId).map((m, i) => ({ ...m, order: i }))
    } else {
      updated = [...current, { task_id: taskId, user_id: userId, order: current.length }]
    }

    setMembersLoading(true)
    const res = await fetch('/api/admin/task-members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, members: updated }),
    })
    if (res.ok) {
      setTaskMembers((prev) => [
        ...prev.filter((m) => m.task_id !== taskId),
        ...updated,
      ])
      showMessage('success', 'Taakverdeling bijgewerkt')
    } else {
      showMessage('error', 'Fout bij opslaan')
    }
    setMembersLoading(false)
  }

  async function moveOrder(taskId: string, userId: string, direction: 'up' | 'down') {
    const current = getMembersForTask(taskId)
    const idx = current.findIndex((m) => m.user_id === userId)
    if (idx < 0) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= current.length) return

    const reordered = [...current]
    ;[reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]]
    const updated = reordered.map((m, i) => ({ ...m, order: i }))

    setMembersLoading(true)
    const res = await fetch('/api/admin/task-members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, members: updated }),
    })
    if (res.ok) {
      setTaskMembers((prev) => [
        ...prev.filter((m) => m.task_id !== taskId),
        ...updated,
      ])
    } else {
      showMessage('error', 'Fout bij opslaan')
    }
    setMembersLoading(false)
  }

  async function regenerateSchema() {
    const res = await fetch('/api/admin/regenerate-schedule', { method: 'POST' })
    if (res.ok) {
      showMessage('success', 'Schema opnieuw gegenereerd!')
    } else {
      showMessage('error', 'Fout bij genereren — probeer het opnieuw')
    }
  }

  async function sendOneNotification(
    userId: string,
    title: string,
    body: string
  ): Promise<{ ok: boolean; count: number; error?: string }> {
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, body, url: '/schema' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, count: 0, error: data.error || `HTTP ${res.status}` }
      return { ok: true, count: data.count ?? 0 }
    } catch (err) {
      return { ok: false, count: 0, error: err instanceof Error ? err.message : 'Netwerkfout' }
    }
  }

  async function sendTestToUser(user: User) {
    setTestingUserId(user.id)
    const result = await sendOneNotification(
      user.id,
      'Tjokkellust Test 🏠',
      `Hoi ${user.name}! Dit is een test. Zie je deze melding, dan werkt het.`
    )
    if (!result.ok) {
      showMessage('error', `${user.name}: ${result.error}`)
    } else if (result.count === 0) {
      showMessage('error', `${user.name} heeft meldingen nog niet ingeschakeld.`)
    } else {
      showMessage('success', `Test verstuurd naar ${user.name} (${result.count} apparaat${result.count !== 1 ? 'en' : ''}).`)
    }
    setTestingUserId(null)
  }

  async function sendTestNotifications() {
    if (!confirm('Test notificatie naar alle huisgenoten sturen?')) return
    setPushLoading(true)
    try {
      const results = await Promise.all(
        users.map((user) =>
          sendOneNotification(
            user.id,
            'Tjokkellust Test 🏠',
            'Dit is een test notificatie. Als je dit ziet, werken de notificaties!'
          )
        )
      )
      const delivered = results.filter((r) => r.ok && r.count > 0).length
      const noSub = results.filter((r) => r.ok && r.count === 0).length
      const failed = results.filter((r) => !r.ok).length
      let text = `Verstuurd naar ${delivered} huisgeno${delivered !== 1 ? 'ten' : 'ot'}.`
      if (noSub > 0) text += ` ${noSub} zonder meldingen aan.`
      if (failed > 0) text += ` ${failed} mislukt.`
      showMessage(failed > 0 ? 'error' : 'success', text)
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Fout bij versturen')
    }
    setPushLoading(false)
  }

  const tabs = [
    { key: 'users', label: 'Huisgenoten' },
    { key: 'tasks', label: 'Taken' },
    { key: 'members', label: 'Taakverdeling' },
    { key: 'schema', label: 'Schema' },
    { key: 'push', label: 'Notificaties' },
  ] as const

  return (
    <div>
      <header className="bg-gradient-to-r from-secondary-900 to-secondary-800 px-4 pt-12 pb-6 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Tjokkellust" className="w-14 h-14 object-contain drop-shadow-lg" />
          <div>
            <p className="text-primary-400 text-xs font-semibold uppercase tracking-widest">Beheer</p>
            <h1 className="text-2xl font-bold text-white leading-tight">Tjokkellust</h1>
          </div>
        </div>
      </header>

      {message && (
        <div
          className={`mx-4 mt-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-4 mt-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* Users tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="card flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() => removeUser(user.id)}
                    disabled={removingUserId === user.id}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-full px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {removingUserId === user.id ? '...' : 'Verwijder'}
                  </button>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="font-semibold text-sm text-slate-900 mb-3">
                Huisgenoot toevoegen
              </h3>
              <form onSubmit={addUser} className="space-y-3">
                <input
                  type="text"
                  placeholder="Naam"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="email"
                  placeholder="E-mailadres"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="password"
                  placeholder="Wachtwoord"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={userLoading}
                  className="btn-primary w-full"
                >
                  {userLoading ? 'Bezig...' : 'Toevoegen'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tasks tab */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="card flex items-center justify-between"
                >
                  <p className="font-medium text-sm text-slate-900">{task.name}</p>
                  <button
                    onClick={() => removeTask(task.id)}
                    disabled={removingTaskId === task.id}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded-full px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {removingTaskId === task.id ? '...' : 'Verwijder'}
                  </button>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 className="font-semibold text-sm text-slate-900 mb-3">
                Taak toevoegen
              </h3>
              <form onSubmit={addTask} className="space-y-3">
                <input
                  type="text"
                  placeholder="Naam van de taak"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={taskLoading}
                  className="btn-primary w-full"
                >
                  {taskLoading ? 'Bezig...' : 'Toevoegen'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Task members tab */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Selecteer taak
              </label>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Kies een taak --</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedTaskId && (
              <div className="card">
                <h3 className="font-semibold text-sm text-slate-900 mb-3">
                  Rotatievolgorde
                </h3>
                <div className="space-y-2 mb-4">
                  {getMembersForTask(selectedTaskId).map((m, i, arr) => {
                    const user = users.find((u) => u.id === m.user_id)
                    return (
                      <div
                        key={m.user_id}
                        className="flex items-center gap-2 bg-slate-50 rounded-lg p-2"
                      >
                        <span className="text-xs text-slate-400 w-5">{i + 1}.</span>
                        <span className="flex-1 text-sm font-medium text-slate-800">
                          {user?.name || 'Onbekend'}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveOrder(selectedTaskId, m.user_id, 'up')}
                            disabled={i === 0 || membersLoading}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveOrder(selectedTaskId, m.user_id, 'down')}
                            disabled={i === arr.length - 1 || membersLoading}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => toggleMember(selectedTaskId, m.user_id)}
                            disabled={membersLoading}
                            className="text-xs text-red-400 hover:text-red-600 ml-1"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {getMembersForTask(selectedTaskId).length === 0 && (
                    <p className="text-xs text-slate-400 italic">
                      Geen huisgenoten toegewezen
                    </p>
                  )}
                </div>

                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Huisgenoten toevoegen
                </h4>
                <div className="space-y-1">
                  {users
                    .filter(
                      (u) =>
                        !getMembersForTask(selectedTaskId).find(
                          (m) => m.user_id === u.id
                        )
                    )
                    .map((u) => (
                      <button
                        key={u.id}
                        onClick={() => toggleMember(selectedTaskId, u.id)}
                        disabled={membersLoading}
                        className="w-full text-left text-sm px-3 py-2 rounded-lg border border-dashed border-slate-300 hover:border-primary-400 hover:bg-primary-50 transition-colors disabled:opacity-50"
                      >
                        + {u.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schema tab */}
        {activeTab === 'schema' && (
          <div className="card">
            <h3 className="font-semibold text-sm text-slate-900 mb-2">
              Schema opnieuw genereren
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Genereer het schema voor de huidige week opnieuw op basis van de
              huidige taakverdeling. Bestaande taken die al als &apos;klaar&apos; zijn
              gemarkeerd blijven ongewijzigd.
            </p>
            <button onClick={regenerateSchema} className="btn-primary">
              Schema genereren
            </button>
          </div>
        )}

        {/* Push notifications tab */}
        {activeTab === 'push' && (
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold text-sm text-slate-900 mb-2">
                Test Notificaties
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Stuur een test notificatie naar alle huisgenoten om te controleren of
                push notificaties werken. Huisgenoten moeten eerst toestemming hebben
                gegeven voor notificaties.
              </p>
              <button
                onClick={sendTestNotifications}
                disabled={pushLoading || users.length === 0}
                className="btn-primary"
              >
                {pushLoading ? 'Versturen...' : `Test notificatie naar ${users.length} huisgenoot${users.length !== 1 ? 'en' : ''}`}
              </button>
            </div>

            {/* Per-housemate test buttons */}
            <div className="card">
              <h3 className="font-semibold text-sm text-slate-900 mb-1">
                Individuele test
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Stuur een test naar één huisgenoot. Een groene stip betekent dat
                diegene meldingen heeft ingeschakeld.
              </p>
              <div className="space-y-1.5">
                {users.map((user) => {
                  const hasSub = subscribedSet.has(user.id)
                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2"
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          hasSub ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                        title={hasSub ? 'Meldingen aan' : 'Meldingen uit'}
                      />
                      <span className="flex-1 text-sm font-medium text-slate-800 truncate">
                        {user.name}
                      </span>
                      <button
                        onClick={() => sendTestToUser(user)}
                        disabled={testingUserId === user.id || !hasSub}
                        className="text-xs font-semibold text-secondary-700 border border-secondary-200 rounded-full px-3 py-1 hover:bg-secondary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {testingUserId === user.id ? '...' : 'Test'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="card bg-blue-50 border-blue-200">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">
                ℹ️ Over notificaties
              </h4>
              <div className="text-xs text-blue-700 space-y-2">
                <p>
                  • Huisgenoten moeten eerst de schema pagina bezoeken en toestemming geven voor notificaties
                </p>
                <p>
                  • Notificaties werken alleen op apparaten die ingelogd zijn en de pagina hebben bezocht
                </p>
                <p>
                  • Automatische wekelijkse herinneringen worden elke maandag verstuurd (via Vercel Cron)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
