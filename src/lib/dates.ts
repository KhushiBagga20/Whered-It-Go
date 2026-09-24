import type { DateKey, MonthKey, TimeKey } from '../data/types'

/**
 * Calendar helpers that never touch timezones: dates are plain
 * 'YYYY-MM-DD' strings and months are 'YYYY-MM'. Lexicographic order
 * of these strings is chronological order, which the finance layer
 * relies on.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function toTimeKey(d: Date): TimeKey {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function todayKey(now = new Date()): DateKey {
  return toDateKey(now)
}

export function currentMonthKey(now = new Date()): MonthKey {
  return monthOf(toDateKey(now))
}

export function monthOf(date: DateKey): MonthKey {
  return date.slice(0, 7)
}

export function parseMonth(month: MonthKey): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number)
  return { year: y, month: m }
}

export function parseDate(date: DateKey): { year: number; month: number; day: number } {
  const [y, m, d] = date.split('-').map(Number)
  return { year: y, month: m, day: d }
}

export function makeMonthKey(year: number, month: number): MonthKey {
  // month may overflow (13 → next year) or underflow (0 → previous year)
  const d = new Date(year, month - 1, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function makeDateKey(year: number, month: number, day: number): DateKey {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const { year, month: m } = parseMonth(month)
  return makeMonthKey(year, m + delta)
}

export function addDays(date: DateKey, delta: number): DateKey {
  const { year, month, day } = parseDate(date)
  return toDateKey(new Date(year, month - 1, day + delta))
}

export function daysInMonth(month: MonthKey): number {
  const { year, month: m } = parseMonth(month)
  return new Date(year, m, 0).getDate()
}

export function firstDayOfMonth(month: MonthKey): DateKey {
  return `${month}-01`
}

export function lastDayOfMonth(month: MonthKey): DateKey {
  return `${month}-${pad(daysInMonth(month))}`
}

export function datesInMonth(month: MonthKey): DateKey[] {
  const n = daysInMonth(month)
  return Array.from({ length: n }, (_, i) => `${month}-${pad(i + 1)}`)
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: DateKey): number {
  const { year, month, day } = parseDate(date)
  return new Date(year, month - 1, day).getDay()
}

export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function monthName(month: MonthKey): string {
  return MONTHS[parseMonth(month).month - 1]
}

export function monthShort(month: MonthKey): string {
  return monthName(month).slice(0, 3)
}

export function monthLabel(month: MonthKey, withYear = true): string {
  const { year } = parseMonth(month)
  return withYear ? `${monthName(month)} ${year}` : monthName(month)
}

export function weekdayShort(dow: number): string {
  return WEEKDAYS[dow].slice(0, 3)
}

export function weekdayInitial(dow: number): string {
  return WEEKDAYS[dow].slice(0, 1)
}

/** "23 September" / "23 September 2026" */
export function formatDayLong(date: DateKey, withYear = false): string {
  const { year, month, day } = parseDate(date)
  return `${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`
}

/** "Wed, 23 Sep" */
export function formatDayShort(date: DateKey): string {
  const { month, day } = parseDate(date)
  return `${weekdayShort(weekdayOf(date))}, ${day} ${MONTHS[month - 1].slice(0, 3)}`
}

/** TODAY / YESTERDAY / 21 SEPTEMBER, relative to `today`. */
export function relativeDayLabel(date: DateKey, today: DateKey): string {
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return `${weekdayShort(weekdayOf(date))}, ${formatDayLong(date)}`
}

/** "8:42 PM" */
export function formatTime(time: TimeKey): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${pad(m)} ${suffix}`
}

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const { year, month, day } = parseDate(value)
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

export function isValidTimeKey(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [h, m] = value.split(':').map(Number)
  return h >= 0 && h < 24 && m >= 0 && m < 60
}

/** Whole days between two dates (b − a). */
export function diffDays(a: DateKey, b: DateKey): number {
  const pa = parseDate(a)
  const pb = parseDate(b)
  const ta = Date.UTC(pa.year, pa.month - 1, pa.day)
  const tb = Date.UTC(pb.year, pb.month - 1, pb.day)
  return Math.round((tb - ta) / 86_400_000)
}
