export { formatCents as money, formatBasisPoints, parseMoneyToCents, parsePercentToBasisPoints, centsToDecimalString } from '../../shared/money'

const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso))
export const formatTime = (iso: string): string => timeFmt.format(new Date(iso))
export const formatDate = (d: Date): string => dateFmt.format(d)

const pad = (n: number): string => String(n).padStart(2, '0')

/** Local date as YYYY-MM-DD (for <input type="date">). */
export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse YYYY-MM-DD as local midnight. */
export function fromDateInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // Strip Electron's "Error invoking remote method ..." prefix if it ever appears.
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}
