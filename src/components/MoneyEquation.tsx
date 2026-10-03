import type { MonthSummary } from '../lib/finance'
import { formatINR } from '../lib/money'
import styles from './MoneyEquation.module.css'

/**
 * STARTED WITH + RECEIVED − SPENT = STILL GOT, as a receipt strip.
 * On a narrow cover screen it folds into a 2×2 grid with the operators
 * riding along on each number.
 */
export function MoneyEquation({ summary, onAdjust }: { summary: MonthSummary; onAdjust?: () => void }) {
  const start = (
    <>
      <span className={`${styles.value} num`}>{formatINR(summary.starting)}</span>
      <span className={styles.label}>
        started with{summary.adjustment !== 0 && <span className={styles.adjusted}>*</span>}
      </span>
    </>
  )
  return (
    <>
      <section className={styles.equation} aria-label="How the balance adds up">
        {onAdjust ? (
          <button type="button" className={`${styles.term} ${styles.adjustable}`} onClick={onAdjust}>
            {start}
          </button>
        ) : (
          <div className={styles.term}>{start}</div>
        )}
        <span className={styles.op} aria-label="plus">
          +
        </span>
        <div className={styles.term} data-op="+">
          <span className={`${styles.value} ${styles.in} num`}>{formatINR(summary.received)}</span>
          <span className={styles.label}>received</span>
        </div>
        <span className={styles.op} aria-label="minus">
          −
        </span>
        <div className={styles.term} data-op="−">
          <span className={`${styles.value} ${styles.out} num`}>{formatINR(summary.spent)}</span>
          <span className={styles.label}>spent</span>
        </div>
        <span className={styles.op} aria-label="equals">
          =
        </span>
        <div className={styles.term} data-op="=">
          <span className={`${styles.value} num`}>{formatINR(summary.current)}</span>
          <span className={styles.label}>still got</span>
        </div>
      </section>
      {summary.adjustment !== 0 && (
        <p className={styles.footnote}>* includes a {formatINR(summary.adjustment, { sign: 'always' })} starting adjustment</p>
      )}
    </>
  )
}
