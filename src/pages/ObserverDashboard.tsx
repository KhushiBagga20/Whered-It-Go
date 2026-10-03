import { AnimatePresence, m } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'wouter'
import { monthSwap, rise, stagger } from '../animations/variants'
import { EmptyState } from '../components/EmptyState'
import { MoneyEquation } from '../components/MoneyEquation'
import { MonthRecap } from '../components/MonthRecap'
import { SpendingChart } from '../components/SpendingChart'
import { TransactionRow } from '../components/TransactionRow'
import { MoneyDisplay } from '../components/ui/MoneyDisplay'
import { formatDayShort, monthName, toDateKey } from '../lib/dates'
import { compareTransactionsDesc } from '../lib/finance'
import { formatINR } from '../lib/money'
import { MascotSpot } from '../mascot/MascotSpot'
import { lineFor } from '../mascot/react'
import {
  useAccountMap,
  useCategoryMap,
  useCategorySlices,
  useMonth,
  useMonthSummary,
  useMonthTransactions,
  useToday,
} from '../state/selectors'
import { useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import dash from './Dashboard.module.css'
import styles from './ObserverDashboard.module.css'

/**
 * Khushi's home: "What has Jais been doing with his money?"
 * Same world, same numbers — her voice a little louder.
 */
export default function ObserverDashboard() {
  const month = useMonth()
  const dir = useUi((s) => s.monthDir)
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <m.div key={month} custom={dir} variants={monthSwap} initial="enter" animate="center" exit="exit">
        <Evidence month={month} />
      </m.div>
    </AnimatePresence>
  )
}

function Evidence({ month }: { month: string }) {
  const summary = useMonthSummary(month)
  const slices = useCategorySlices(month)
  const txns = useMonthTransactions(month)
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const today = useToday()
  const comments = useData((s) => s.comments)
  const allTxns = useData((s) => s.transactions)
  const owner = useData((s) => s.members.find((mm) => mm.role === 'owner'))
  const jais = owner?.name || 'Jais'
  const isCurrent = today.slice(0, 7) === month
  const recent = useMemo(() => [...txns].sort(compareTransactionsDesc).slice(0, 6), [txns])

  const topKey = slices[0]?.category.key ?? null
  const verdict = useMemo(
    () => (isCurrent ? lineFor('verdict', month, { categoryKey: topKey, spentMonth: summary.spent })?.message : undefined),
    [isCurrent, month, topKey, summary.spent],
  )

  const myNotes = useMemo(() => {
    const byId = new Map(allTxns.map((t) => [t.id, t]))
    return [...comments]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 5)
      .map((c) => ({ c, tx: byId.get(c.transactionId) }))
      .filter((x) => x.tx)
  }, [comments, allTxns])

  return (
    <m.div className={dash.page} variants={stagger(0.05)} initial="initial" animate="animate">
      <m.header className={styles.head} variants={rise}>
        <p className="eyebrow">The evidence</p>
        <h1 className={styles.title}>What has {jais} been doing with his money?</h1>
      </m.header>

      <m.section className={styles.figures} variants={rise} aria-label={`${monthName(month)} summary`}>
        <div className={styles.figure}>
          <span className="eyebrow">Still got</span>
          <MoneyDisplay value={summary.current} className={`${styles.big} num`} />
        </div>
        <div className={styles.figure}>
          <span className="eyebrow">Current damage</span>
          <MoneyDisplay value={summary.spent} className={`${styles.big} ${styles.gone} num`} />
        </div>
        <div className={styles.figure}>
          <span className="eyebrow">Came in</span>
          <MoneyDisplay value={summary.received} className={`${styles.big} ${styles.came} num`} />
        </div>
      </m.section>

      <m.div variants={rise}>
        <MoneyEquation summary={summary} />
      </m.div>

      {verdict && (
        <m.section className={styles.verdict} variants={rise} aria-label="Khushi’s verdict">
          <MascotSpot pose="stand" expression="judging" size={78} bubble="right" />
          <div>
            <p className="eyebrow">The verdict, so far</p>
            <p className={styles.verdictLine}>{verdict}</p>
          </div>
        </m.section>
      )}

      <div className={dash.grid}>
        <m.section variants={rise} aria-labelledby="evidence-title">
          <div className={dash.recentHead}>
            <h2 id="evidence-title" className={dash.sectionTitle}>
              Latest evidence
            </h2>
            {txns.length > 0 && (
              <Link href="/history" className={dash.seeAll}>
                All of it <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {recent.length ? (
            <ul className={dash.recentList}>
              {recent.map((t) => (
                <li key={t.id}>
                  <TransactionRow tx={t} category={categories.get(t.categoryId)} account={accounts.get(t.accountId)} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing to investigate yet." line={`${jais} hasn’t logged anything in ${monthName(month)}.`} expression="sleepy" size={64} />
          )}
        </m.section>

        <m.section className={dash.chartSection} variants={rise} aria-labelledby="where-title">
          <h2 id="where-title" className={dash.sectionTitle}>
            Where it went
          </h2>
          {slices.length ? (
            <SpendingChart slices={slices} total={summary.spent} showMascot={false} />
          ) : (
            <p className={styles.quiet}>Look at him. Financially mysterious.</p>
          )}
        </m.section>
      </div>

      <MonthRecap month={month} />

      <m.section variants={rise} aria-labelledby="notes-title">
        <h2 id="notes-title" className={dash.sectionTitle}>
          Your notes
        </h2>
        {myNotes.length ? (
          <ul className={styles.notes}>
            {myNotes.map(({ c, tx }) => (
              <li key={c.id}>
                <button type="button" className={styles.note} onClick={() => ui.showDetail(tx!.id)}>
                  <span className={styles.noteText}>{c.comment}</span>
                  <span className={styles.noteOn}>
                    on {tx!.description || 'a transaction'} · {formatINR(tx!.amount)} ·{' '}
                    {formatDayShort(toDateKey(new Date(c.createdAt)))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.quiet}>Khushi has remained suspiciously silent. Tap any transaction to leave a note.</p>
        )}
      </m.section>
    </m.div>
  )
}
