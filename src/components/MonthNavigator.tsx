import { AnimatePresence, m } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, daysInMonth, monthLabel, monthName, parseMonth } from '../lib/dates'
import { useMonthBounds, useToday } from '../state/selectors'
import { ui, useUi } from '../state/ui'
import styles from './MonthNavigator.module.css'

function caption(month: string, today: string) {
  const current = today.slice(0, 7)
  if (month === current) return `day ${Number(today.slice(8, 10))} of ${daysInMonth(month)}`
  if (month < current) return 'wrapped'
  return 'hasn’t happened yet'
}

/** ‹ August | September 2026 | October › with a slide between months. */
export function MonthNavigator({ compact = false }: { compact?: boolean }) {
  const month = useUi((s) => s.month)
  const dir = useUi((s) => s.monthDir)
  const { min, max } = useMonthBounds()
  const today = useToday()
  const prev = addMonths(month, -1)
  const next = addMonths(month, 1)
  const canPrev = prev >= min
  const canNext = next <= max
  const { year } = parseMonth(month)
  const showYear = year !== Number(today.slice(0, 4))

  return (
    <nav className={`${styles.nav} ${compact ? styles.compact : ''}`} aria-label="Month">
      <button
        type="button"
        className={styles.arrow}
        onClick={() => ui.setMonth(prev)}
        disabled={!canPrev}
        aria-label={`Previous month, ${monthLabel(prev)}`}
      >
        <ChevronLeft size={22} strokeWidth={2.6} />
        {!compact && <span className={styles.peek}>{monthName(prev).slice(0, 3)}</span>}
      </button>
      <div className={styles.center} aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.div
            key={month}
            className={styles.label}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0, rotate: d * 3 }),
              center: { x: 0, opacity: 1, rotate: 0 },
              exit: (d: number) => ({ x: d * -40, opacity: 0, rotate: d * -3 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            <span className={styles.month}>
              {monthName(month)}
              {showYear && <span className={styles.year}> {year}</span>}
            </span>
            <span className={styles.caption}>{caption(month, today)}</span>
          </m.div>
        </AnimatePresence>
      </div>
      <button
        type="button"
        className={styles.arrow}
        onClick={() => ui.setMonth(next)}
        disabled={!canNext}
        aria-label={`Next month, ${monthLabel(next)}`}
      >
        {!compact && <span className={styles.peek}>{monthName(next).slice(0, 3)}</span>}
        <ChevronRight size={22} strokeWidth={2.6} />
      </button>
    </nav>
  )
}
