export type WasteType = 'restafval' | 'papier' | 'gft'

export interface WastePickup {
  datum: string
  dag: string
  type: WasteType
}

export const WASTE_ADDRESS = 'Boerhaavelaan 28, 2334 EP Leiden'

export const WASTE_PICKUPS_2026: WastePickup[] = [
  { datum: '2026-03-04', dag: 'Wo', type: 'restafval' },
  { datum: '2026-03-10', dag: 'Di', type: 'papier' },
  { datum: '2026-03-11', dag: 'Wo', type: 'gft' },
  { datum: '2026-03-18', dag: 'Wo', type: 'restafval' },
  { datum: '2026-03-25', dag: 'Wo', type: 'gft' },
  { datum: '2026-04-01', dag: 'Wo', type: 'restafval' },
  { datum: '2026-04-07', dag: 'Di', type: 'papier' },
  { datum: '2026-04-08', dag: 'Wo', type: 'gft' },
  { datum: '2026-04-15', dag: 'Wo', type: 'restafval' },
  { datum: '2026-04-22', dag: 'Wo', type: 'gft' },
  { datum: '2026-04-29', dag: 'Wo', type: 'restafval' },
  { datum: '2026-05-06', dag: 'Wo', type: 'gft' },
  { datum: '2026-05-09', dag: 'Za', type: 'papier' },
  { datum: '2026-05-13', dag: 'Wo', type: 'restafval' },
  { datum: '2026-05-20', dag: 'Wo', type: 'gft' },
  { datum: '2026-05-27', dag: 'Wo', type: 'restafval' },
  { datum: '2026-06-02', dag: 'Di', type: 'papier' },
  { datum: '2026-06-03', dag: 'Wo', type: 'gft' },
  { datum: '2026-06-10', dag: 'Wo', type: 'restafval' },
  { datum: '2026-06-17', dag: 'Wo', type: 'gft' },
  { datum: '2026-06-24', dag: 'Wo', type: 'restafval' },
  { datum: '2026-06-30', dag: 'Di', type: 'papier' },
  { datum: '2026-07-01', dag: 'Wo', type: 'gft' },
  { datum: '2026-07-08', dag: 'Wo', type: 'restafval' },
  { datum: '2026-07-15', dag: 'Wo', type: 'gft' },
  { datum: '2026-07-22', dag: 'Wo', type: 'restafval' },
  { datum: '2026-07-28', dag: 'Di', type: 'papier' },
  { datum: '2026-07-29', dag: 'Wo', type: 'gft' },
  { datum: '2026-08-05', dag: 'Wo', type: 'restafval' },
  { datum: '2026-08-12', dag: 'Wo', type: 'gft' },
  { datum: '2026-08-19', dag: 'Wo', type: 'restafval' },
  { datum: '2026-08-25', dag: 'Di', type: 'papier' },
  { datum: '2026-08-26', dag: 'Wo', type: 'gft' },
  { datum: '2026-09-02', dag: 'Wo', type: 'restafval' },
  { datum: '2026-09-09', dag: 'Wo', type: 'gft' },
  { datum: '2026-09-16', dag: 'Wo', type: 'restafval' },
  { datum: '2026-09-22', dag: 'Di', type: 'papier' },
  { datum: '2026-09-23', dag: 'Wo', type: 'gft' },
  { datum: '2026-09-30', dag: 'Wo', type: 'restafval' },
  { datum: '2026-10-07', dag: 'Wo', type: 'gft' },
  { datum: '2026-10-14', dag: 'Wo', type: 'restafval' },
  { datum: '2026-10-20', dag: 'Di', type: 'papier' },
  { datum: '2026-10-21', dag: 'Wo', type: 'gft' },
  { datum: '2026-10-28', dag: 'Wo', type: 'restafval' },
  { datum: '2026-11-04', dag: 'Wo', type: 'gft' },
  { datum: '2026-11-11', dag: 'Wo', type: 'restafval' },
  { datum: '2026-11-17', dag: 'Di', type: 'papier' },
  { datum: '2026-11-18', dag: 'Wo', type: 'gft' },
  { datum: '2026-11-25', dag: 'Wo', type: 'restafval' },
  { datum: '2026-12-02', dag: 'Wo', type: 'gft' },
  { datum: '2026-12-09', dag: 'Wo', type: 'restafval' },
  { datum: '2026-12-15', dag: 'Di', type: 'papier' },
  { datum: '2026-12-16', dag: 'Wo', type: 'gft' },
  { datum: '2026-12-23', dag: 'Wo', type: 'restafval' },
  { datum: '2026-12-30', dag: 'Wo', type: 'gft' },
]

function formatDateInAmsterdam(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getWasteTypeLabel(type: WasteType): string {
  if (type === 'gft') return 'GFT'
  if (type === 'papier') return 'Papier'
  return 'Restafval'
}

export function getUpcomingWastePickups(now: Date, limit = 6): WastePickup[] {
  const today = formatDateInAmsterdam(now)
  return WASTE_PICKUPS_2026.filter((p) => p.datum >= today).slice(0, limit)
}

export function getFirstWastePickupInWeek(monday: Date): WastePickup | null {
  const weekStart = formatDateInAmsterdam(monday)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const weekEnd = formatDateInAmsterdam(sunday)

  return (
    WASTE_PICKUPS_2026.find(
      (pickup) => pickup.datum >= weekStart && pickup.datum <= weekEnd
    ) ?? null
  )
}

export function getTomorrowWastePickups(now: Date): WastePickup[] {
  const today = formatDateInAmsterdam(now)
  const tomorrow = addDays(today, 1)
  return WASTE_PICKUPS_2026.filter((p) => p.datum === tomorrow)
}
