/**
 * Money primitives. Amounts live in rupees on entities (what people type),
 * but every sum goes through integer paise so 0.1 + 0.2 never happens.
 */

export const toPaise = (rupees: number): number => Math.round(rupees * 100)
export const fromPaise = (paise: number): number => paise / 100

export function sumRupees(values: Iterable<number>): number {
  let total = 0
  for (const v of values) total += toPaise(v)
  return fromPaise(total)
}

const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const fractional = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface FormatOptions {
  /** 'auto' shows − for negatives only; 'always' adds + for positives; 'never' drops the sign. */
  sign?: 'auto' | 'always' | 'never'
  /** Show paise only when the value isn't a whole rupee (default true). */
  paise?: boolean
  symbol?: boolean
}

/** ₹1,23,456 · −₹320 · +₹2,000 · ₹99.50 (Indian digit grouping). */
export function formatINR(value: number, opts: FormatOptions = {}): string {
  const { sign = 'auto', paise = true, symbol = true } = opts
  const abs = Math.abs(value)
  const p = toPaise(abs)
  const body = paise && p % 100 !== 0 ? fractional.format(abs) : whole.format(Math.round(abs))
  const cur = symbol ? '₹' : ''
  let prefix = ''
  if (sign !== 'never') {
    if (value < 0 && p !== 0) prefix = '−'
    else if (sign === 'always' && p !== 0) prefix = '+'
  }
  return `${prefix}${cur}${body}`
}

/** ₹1.2k / ₹12k / ₹1.4L — for tiny calendar tiles. */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (abs < 1000) return `${sign}₹${Math.round(abs)}`
  if (abs < 100_000) {
    const k = abs / 1000
    return `${sign}₹${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`
  }
  const l = abs / 100_000
  return `${sign}₹${l < 10 ? l.toFixed(1).replace(/\.0$/, '') : Math.round(l)}L`
}

/** Accepts "1,200", "₹ 320.5", "99." — returns NaN when it isn't a number. */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/[₹,\s]/g, '')
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return Number.NaN
  return Number(cleaned)
}

/** Clamp typing to digits + one dot + two decimals. */
export function sanitizeAmountInput(input: string): string {
  let s = input.replace(/[^\d.]/g, '')
  const dot = s.indexOf('.')
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  s = s.replace(/^0+(?=\d)/, '')
  return s.slice(0, 12)
}
