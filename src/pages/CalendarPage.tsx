import { AnimatePresence, m } from 'motion/react'
import { monthSwap } from '../animations/variants'
import { CalendarLegend, SpendingCalendar } from '../components/SpendingCalendar'
import { formatDayShort, monthName } from '../lib/dates'
import { formatINR } from '../lib/money'
import { MascotSpot } from '../mascot/MascotSpot'
import { useDaily, useInsights, useMonth, useMonthSummary, useToday, useTrackingStart } from '../state/selectors'
import { useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import styles from './CalendarPage.module.css'

export default function CalendarPage() {
  const month = useMonth()
  const dir = useUi((s) => s.monthDir)
  const summary = useMonthSummary(month)
  const insights = useInsights(month)
  const days = useDaily(month)
  const today = useToday()
  const trackingStart = useTrackingStart()
  const weekStartsOn = useData((s) => s.profile.prefs.weekStartsOn)
  const isCurrent = today.slice(0, 7) === month
  const future = month > today.slice(0, 7)

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">When did it go?</p>
        <h1 className={styles.title}>
          <span className="num">{formatINR(summary.spent)}</span>{' '}
          <span className={styles.titleSoft}>
            across {insights.spendDays} {insights.spendDays === 1 ? 'day' : 'days'}
          </span>
        </h1>
      </header>

      <div className={styles.calendarBox}>
        <div className={styles.peek}>
          <MascotSpot pose="peek" expression={insights.spendDays > insights.calmDays ? 'suspicious' : 'happy'} size={52} bubble="left" />
        </div>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <m.div key={month} custom={dir} variants={monthSwap} initial="enter" animate="center" exit="exit">
            <SpendingCalendar
              month={month}
              days={days}
              today={today}
              trackingStart={trackingStart}
              weekStartsOn={weekStartsOn}
            />
          </m.div>
        </AnimatePresence>
      </div>

      <CalendarLegend />

      <section className={styles.facts} aria-label={`${monthName(month)} patterns`}>
        {future ? (
          <p className={styles.quiet}>Peaceful. For now.</p>
        ) : summary.spent === 0 ? (
          <p className={styles.quiet}>Peaceful. Not a single rupee spent.</p>
        ) : (
          <>
            <div className={styles.fact}>
              <span className={`${styles.factValue} num`} data-tone="calm">
                {insights.calmDays}
              </span>
              <span className={styles.factLabel}>no-spend {insights.calmDays === 1 ? 'day' : 'days'}</span>
            </div>
            <div className={styles.fact}>
              <span className={`${styles.factValue} num`} data-tone="spent">
                {insights.spendDays}
              </span>
              <span className={styles.factLabel}>spending {insights.spendDays === 1 ? 'day' : 'days'}</span>
            </div>
            {insights.biggestDay && (
              <button type="button" className={styles.fact} onClick={() => ui.showDay(insights.biggestDay!.date)}>
                <span className={`${styles.factValue} num`} data-tone="hot">
                  {formatINR(insights.biggestDay.spent)}
                </span>
                <span className={styles.factLabel}>worst day · {formatDayShort(insights.biggestDay.date)}</span>
              </button>
            )}
          </>
        )}
      </section>
      {isCurrent && summary.received > 0 && (
        <p className={styles.note}>
          <span className={styles.sunDot} aria-hidden="true" /> {formatINR(summary.received)} came in this month.
        </p>
      )}
    </div>
  )
}
