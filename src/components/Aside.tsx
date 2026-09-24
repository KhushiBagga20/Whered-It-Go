import { Flame, Sprout } from 'lucide-react'
import { formatINR } from '../lib/money'
import { MascotSpot } from '../mascot/MascotSpot'
import { useDaily, useMonth, useMonthProgress, useNoSpendStreak, useToday } from '../state/selectors'
import { ui } from '../state/ui'
import styles from './Aside.module.css'
import { Sun } from './world/Sun'

/**
 * Wide screens get an environment panel: the sun (tracking the month),
 * today at a glance, and her — full size, with room to talk.
 */
export function Aside() {
  const month = useMonth()
  const progress = useMonthProgress(month)
  const today = useToday()
  const days = useDaily(today.slice(0, 7))
  const streak = useNoSpendStreak()
  const spentToday = days.get(today)?.spent ?? 0
  const countToday = days.get(today)?.transactions.filter((t) => t.type === 'expense').length ?? 0

  return (
    <aside className={styles.aside} aria-label="Today">
      <div className={styles.sun}>
        <Sun progress={progress} size={128} />
      </div>
      <div className={styles.today}>
        <button type="button" className={styles.todayCard} onClick={() => ui.showDay(today)}>
          <span className="eyebrow">Today</span>
          <span className={`${styles.todayValue} num`} data-calm={spentToday === 0 || undefined}>
            {spentToday ? formatINR(-spentToday) : '₹0'}
          </span>
          <span className={styles.todayLine}>
            {spentToday ? (
              <>
                <Flame size={15} aria-hidden="true" /> {countToday} {countToday === 1 ? 'thing' : 'things'} so far
              </>
            ) : (
              <>
                <Sprout size={15} aria-hidden="true" /> {streak > 1 ? `${streak} calm days in a row` : 'a calm day (so far)'}
              </>
            )}
          </span>
        </button>
      </div>
      <div className={styles.stage}>
        <MascotSpot stage pose="stand" size={132} bubble="top" expression={spentToday > 1000 ? 'judging' : 'neutral'} />
      </div>
    </aside>
  )
}
