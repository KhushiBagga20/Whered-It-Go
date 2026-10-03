import { m } from 'motion/react'
import { useMemo } from 'react'
import { formatDayLong, monthLabel, monthName } from '../lib/dates'
import { calculateMonthlySummary } from '../lib/finance'
import { formatINR } from '../lib/money'
import { lineFor } from '../mascot/react'
import { useLedger, useToday, useTrackingStart } from '../state/selectors'
import { useData } from '../state/store'
import { ui } from '../state/ui'
import { CategoryBadge } from './ui/CategoryBadge'
import styles from './MonthRecap.module.css'

/**
 * The month on a receipt: what came in, what went missing, what survived,
 * the superlatives, and Khushi's closing remark. "So far" for the current
 * month, a proper wrap-up for finished ones.
 */
export function MonthRecap({ month }: { month: string }) {
  const ledger = useLedger()
  const categories = useData((s) => s.categories)
  const today = useToday()
  const since = useTrackingStart()
  const r = useMemo(
    () => calculateMonthlySummary(ledger, categories, month, today, since),
    [ledger, categories, month, today, since],
  )
  const finished = month < today.slice(0, 7)
  const future = month > today.slice(0, 7)
  // One remark per (month, numbers) — not a new one every render.
  const remark = useMemo(
    () =>
      lineFor(finished ? 'month-end' : 'verdict', month, {
        categoryKey: r.mostExpensiveCategory?.category.key ?? null,
        spentMonth: r.wentMissing,
        receivedMonth: r.cameIn,
      })?.message,
    // re-rolls only when the month's story changes
    [finished, month, r.mostExpensiveCategory?.category.key, r.wentMissing, r.cameIn],
  )

  if (future || r.transactionCount === 0) return null

  const survivedLine =
    r.survived >= 0 ? (
      <>
        <strong className="num">{formatINR(r.survived)}</strong> survived
      </>
    ) : (
      <>
        <strong className="num">{formatINR(-r.survived)}</strong> more went than came
      </>
    )

  return (
    <m.section
      className={styles.receipt}
      aria-labelledby={`recap-${month}`}
      initial={{ opacity: 0, y: 20, rotate: -2 }}
      whileInView={{ opacity: 1, y: 0, rotate: -0.6 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
    >
      <h2 id={`recap-${month}`} className={styles.title}>
        {finished ? monthLabel(month, false) : `${monthName(month)} so far`}
      </h2>
      <ul className={styles.big}>
        <li>
          <strong className={`${styles.in} num`}>{formatINR(r.cameIn)}</strong> came in
        </li>
        <li>
          <strong className={`${styles.out} num`}>{formatINR(r.wentMissing)}</strong> went missing
        </li>
        <li data-tone={r.survived >= 0 ? 'ok' : 'bad'}>{survivedLine}</li>
      </ul>

      <dl className={styles.facts}>
        {r.mostExpensiveCategory && (
          <div>
            <dt>Most expensive category</dt>
            <dd>
              <CategoryBadge category={r.mostExpensiveCategory.category} size={22} /> {r.mostExpensiveCategory.category.name} —{' '}
              <span className="num">{formatINR(r.mostExpensiveCategory.total)}</span>
            </dd>
          </div>
        )}
        {r.mostExpensiveDay && (
          <div>
            <dt>Most expensive day</dt>
            <dd>
              <button type="button" className={styles.dayLink} onClick={() => ui.showDay(r.mostExpensiveDay!.date)}>
                {formatDayLong(r.mostExpensiveDay.date)}
              </button>{' '}
              — <span className="num">{formatINR(r.mostExpensiveDay.spent)}</span>
            </dd>
          </div>
        )}
        {r.mostPeacefulDay && (
          <div>
            <dt>Most peaceful day</dt>
            <dd>
              <button type="button" className={styles.dayLink} onClick={() => ui.showDay(r.mostPeacefulDay!.date)}>
                {formatDayLong(r.mostPeacefulDay.date)}
              </button>{' '}
              — <span className="num">{formatINR(r.mostPeacefulDay.spent)}</span>
            </dd>
          </div>
        )}
        {r.mostSuspiciousCategory && (
          <div>
            <dt>Most suspicious category</dt>
            <dd>
              <CategoryBadge category={r.mostSuspiciousCategory.category} size={22} /> {r.mostSuspiciousCategory.category.name} —{' '}
              <span className="num">{formatINR(r.mostSuspiciousCategory.total)}</span>
              <span className={styles.why}>
                {r.mostSuspiciousCategory.reason === 'jump'
                  ? `up ${formatINR(r.mostSuspiciousCategory.detail)} on last month`
                  : `${r.mostSuspiciousCategory.detail} separate times`}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {remark && (
        <p className={styles.remark}>
          <span aria-hidden="true">“</span>
          {remark}
          <span aria-hidden="true">”</span> <span className={styles.sig}>— khushi</span>
        </p>
      )}
    </m.section>
  )
}
