import { m, useReducedMotion } from 'motion/react'
import { Plus, Sprout } from 'lucide-react'
import { useRef } from 'react'
import type { DateKey, MonthKey } from '../data/types'
import { datesInMonth, formatDayLong, weekdayInitial, weekdayOf, weekdayShort } from '../lib/dates'
import { calculateSpendingIntensity, type DayActivity } from '../lib/finance'
import { formatCompactINR, formatINR } from '../lib/money'
import { ui } from '../state/ui'
import styles from './SpendingCalendar.module.css'

const BLOBS = ['var(--blob-a)', 'var(--blob-b)', 'var(--blob-c)']

function describeDay(date: DateKey, day: DayActivity, state: string): string {
  const parts = [formatDayLong(date)]
  if (state === 'future') parts.push('hasn’t happened yet')
  else if (state === 'before') parts.push('before tracking started')
  else if (day.spent > 0) parts.push(`spent ${formatINR(day.spent)}`)
  else parts.push('no spending')
  if (day.received > 0) parts.push(`received ${formatINR(day.received)}`)
  if (day.count) parts.push(`${day.count} ${day.count === 1 ? 'transaction' : 'transactions'}`)
  return parts.join(', ')
}

/**
 * When did the money go? Every day is a little organic tile:
 * calm days are green with a sprout, spending days glow from a faint
 * blush to loud rose with the amount written on them, and days money
 * came in get a small sun. Colour is never the only signal.
 */
export function SpendingCalendar({
  month,
  days,
  today,
  trackingStart,
  weekStartsOn,
}: {
  month: MonthKey
  days: Map<DateKey, DayActivity>
  today: DateKey
  trackingStart: DateKey
  weekStartsOn: 0 | 1
}) {
  const reduced = useReducedMotion()
  const grid = useRef<HTMLDivElement>(null)
  const dates = datesInMonth(month)
  const lead = (weekdayOf(dates[0]) - weekStartsOn + 7) % 7
  const weekdays = Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    if (!step) return
    const current = (document.activeElement as HTMLElement | null)?.dataset.index
    if (current === undefined) return
    const next = Math.min(dates.length - 1, Math.max(0, Number(current) + step))
    grid.current?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus()
    e.preventDefault()
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.weekdays} aria-hidden="true">
        {weekdays.map((d) => (
          <span key={d}>{weekdayInitial(d)}</span>
        ))}
      </div>
      <div ref={grid} className={styles.grid} role="grid" aria-label="Spending calendar" onKeyDown={onKeyDown}>
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} className={styles.pad} aria-hidden="true" />
        ))}
        {dates.map((date, i) => {
          const day = days.get(date)!
          const future = date > today
          const before = date < trackingStart
          const state = future ? 'future' : before ? 'before' : day.spent > 0 ? 'spent' : 'calm'
          const intensity = calculateSpendingIntensity(day.spent)
          const dayNum = i + 1
          return (
            <m.button
              key={date}
              type="button"
              role="gridcell"
              data-index={i}
              tabIndex={date === today || (i === 0 && today.slice(0, 7) !== month) ? 0 : -1}
              className={styles.day}
              data-state={state}
              data-heat={state === 'spent' ? intensity : undefined}
              data-today={date === today || undefined}
              style={{ borderRadius: BLOBS[(dayNum * 7) % 3] }}
              aria-label={describeDay(date, day, state)}
              title={`${weekdayShort(weekdayOf(date))} ${dayNum}`}
              onClick={() => ui.showDay(date)}
              initial={reduced ? false : { opacity: 0, scale: 0.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 22, delay: reduced ? 0 : 0.012 * (i + lead) }}
              whileTap={{ scale: 0.9 }}
            >
              <span className={styles.num}>{dayNum}</span>
              {state === 'calm' && <Sprout size={15} strokeWidth={2.6} className={styles.sprout} aria-hidden="true" />}
              {state === 'spent' && (
                <m.span
                  key={day.spent}
                  className={`${styles.amt} num`}
                  initial={reduced ? false : { scale: 1.35 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                >
                  {formatCompactINR(day.spent)}
                </m.span>
              )}
              {day.received > 0 && (
                <span className={styles.sun} aria-hidden="true">
                  <Plus size={10} strokeWidth={4} />
                </span>
              )}
            </m.button>
          )
        })}
      </div>
    </div>
  )
}

/** Key for the calendar — shapes and icons, not just colours. */
export function CalendarLegend() {
  return (
    <ul className={styles.legend} aria-label="Legend">
      <li>
        <span className={styles.key} data-state="calm">
          <Sprout size={12} strokeWidth={2.8} />
        </span>
        no spending
      </li>
      <li>
        <span className={styles.ramp} aria-hidden="true">
          {[1, 2, 3, 4, 5].map((h) => (
            <span key={h} data-heat={h} />
          ))}
        </span>
        spent: a little → a lot
      </li>
      <li>
        <span className={styles.keySun} aria-hidden="true">
          <Plus size={9} strokeWidth={4} />
        </span>
        money in
      </li>
    </ul>
  )
}
