import type { BasisPoints, Cents } from './types'

/** Thrown for any business-rule violation; the message is safe to show to the cashier. */
export class PosError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PosError'
  }
}

export function assertCents(value: number, label = 'Amount'): void {
  if (!Number.isSafeInteger(value)) throw new PosError(`${label} must be a whole number of cents.`)
}

/** Round-half-up of (amount * bp / 10000) using integer arithmetic only. Requires amount >= 0, bp >= 0. */
export function applyBasisPoints(amountCents: Cents, bp: BasisPoints): Cents {
  assertCents(amountCents)
  if (!Number.isSafeInteger(bp)) throw new PosError('Percentage is invalid.')
  if (amountCents < 0 || bp < 0) throw new PosError('Amount and percentage must be positive.')
  return Math.floor((amountCents * bp + 5000) / 10000)
}

export function formatCents(cents: Cents): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rest = abs % 100
  const withCommas = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}$${withCommas}.${rest.toString().padStart(2, '0')}`
}

/** Plain decimal string without currency symbol, e.g. 1234 -> "12.34" (used for inputs and CSV). */
export function centsToDecimalString(cents: Cents): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  return `${negative ? '-' : ''}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`
}

/**
 * Parse a user-typed money string ("12", "12.5", "$1,234.56") into cents without floating point.
 * Returns null for anything that is not a valid non-negative amount with at most 2 decimals.
 */
export function parseMoneyToCents(input: string): Cents | null {
  const s = input.trim().replace(/^\$/, '').replace(/,/g, '')
  if (s === '') return null
  const m = /^(\d{0,9})(?:\.(\d{0,2}))?$/.exec(s)
  if (!m) return null
  const whole = m[1] ?? ''
  const frac = m[2] ?? ''
  if (whole === '' && frac === '') return null
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'))
}

/**
 * Parse a percentage string ("10", "12.5", "8.25%") into basis points.
 * Returns null for invalid input or more than 2 decimals.
 */
export function parsePercentToBasisPoints(input: string): BasisPoints | null {
  const s = input.trim().replace(/%$/, '').trim()
  if (s === '') return null
  const m = /^(\d{0,3})(?:\.(\d{0,2}))?$/.exec(s)
  if (!m) return null
  const whole = m[1] ?? ''
  const frac = m[2] ?? ''
  if (whole === '' && frac === '') return null
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'))
}

/** 1000 -> "10", 825 -> "8.25", 1250 -> "12.5" */
export function formatBasisPoints(bp: BasisPoints): string {
  const whole = Math.floor(bp / 100)
  const frac = bp % 100
  if (frac === 0) return `${whole}`
  return `${whole}.${frac.toString().padStart(2, '0').replace(/0$/, '')}`
}
