import { AnimatePresence, m } from 'motion/react'
import { ArrowRight, Flame, Sprout, TrendingDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'wouter'
import { monthSwap, rise, stagger } from '../animations/variants'
import { EmptyState } from '../components/EmptyState'
import { MoneyEquation } from '../components/MoneyEquation'
import { MonthRecap } from '../components/MonthRecap'
import { MonthStartSheet } from '../components/MonthStartSheet'
import { SpendingChart } from '../components/SpendingChart'
import { TransactionRow } from '../components/TransactionRow'
import { MoneyDisplay } from '../components/ui/MoneyDisplay'
import { formatDayShort, monthName } from '../lib/dates'
import { compareTransactionsDesc } from '../lib/finance'
import { formatINR } from '../lib/money'
import {
  useAccountMap,
  useCategoryMap,
  useCategorySlices,
  useDaily,
  useInsights,
  useMonth,
  useMonthSummary,
  useMonthTransactions,
  useToday,
} from '../state/selectors'
import { useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const month = useMonth()
  const dir = useUi((s) => s.monthDir)
  return (
    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
      <m.div key={month} custom={dir} variants={monthSwap} initial="enter" animate="center" exit="exit">
        <DashboardMonth month={month} />
      </m.div>
    </AnimatePresence>
  )
}

function DashboardMonth({ month }: { month: string }) {
  const summary = useMonthSummary(month)
  const slices = useCategorySlices(month)
  const insights = useInsights(month)
  const days = useDaily(month)
  const today = useToday()
  const txns = useMonthTransactions(month)
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const [adjusting, setAdjusting] = useState(false)
  const owner = useData((s) => s.viewer?.role !== 'observer')
  const isCurrent = today.slice(0, 7) === month
  const todayActivity = isCurrent ? days.get(today) : undefined
  const recent = [...txns].sort(compareTransactionsDesc).slice(0, 4)

  return (
    <m.div className={styles.page} variants={stagger(0.05)} initial="initial" animate="animate">
      {/* ── The two numbers that matter, equally loud ── */}
      <m.section className={styles.hero} variants={rise} aria-label={`${monthName(month)} summary`}>
        <div className={styles.figure}>
          <span className="eyebrow">Still got</span>
          <MoneyDisplay value={summary.current} className={`${styles.big} num`} />
        </div>
        <div className={styles.figure}>
          <span className="eyebrow">Went missing</span>
          <MoneyDisplay value={summary.spent} className={`${styles.big} ${styles.gone} num`} />
        </div>
      </m.section>

      {/* ── How we got there: start + in − out = now ── */}
      <m.div variants={rise}>
        <MoneyEquation summary={summary} onAdjust={owner ? () => setAdjusting(true) : undefined} />
      </m.div>

      {!isCurrent && <MonthRecap month={month} />}

      {isCurrent && (
        <m.button
          type="button"
          className={styles.today}
          variants={rise}
          onClick={() => ui.showDay(today)}
          data-calm={!todayActivity?.spent || undefined}
        >
          <span className={styles.todayIcon} aria-hidden="true">
            {todayActivity?.spent ? <Flame size={18} /> : <Sprout size={18} />}
          </span>
          <span className={styles.todayText}>
            <strong>Today</strong>{' '}
            {todayActivity?.spent
              ? `${formatINR(-todayActivity.spent)} across ${todayActivity.transactions.filter((t) => t.type === 'expense').length} ${todayActivity.transactions.filter((t) => t.type === 'expense').length === 1 ? 'thing' : 'things'}`
              : 'nothing spent yet. look at you.'}
          </span>
          <ArrowRight size={18} className={styles.todayArrow} aria-hidden="true" />
        </m.button>
      )}

      <div className={styles.grid}>
        {/* ── WHERE'D IT GO? ── */}
        <m.section className={styles.chartSection} variants={rise} aria-labelledby="whered-title">
          <h2 id="whered-title" className={styles.sectionTitle}>
            Where’d it go?
          </h2>
          {slices.length ? (
            <SpendingChart slices={slices} total={summary.spent} />
          ) : (
            <EmptyState
              title="Look at you. Responsible."
              line={`Nothing spent in ${monthName(month)}${isCurrent ? ' yet' : ''}. Suspicious, but okay.`}
              expression="proud"
            />
          )}
        </m.section>

        <div className={styles.side}>
          {/* ── Patterns ── */}
          <m.section className={styles.stats} variants={rise} aria-label="Patterns">
            <div className={styles.stat}>
              <Sprout size={18} className={styles.statIcon} data-tone="calm" aria-hidden="true" />
              <span className={`${styles.statValue} num`}>{insights.calmDays}</span>
              <span className={styles.statLabel}>no-spend {insights.calmDays === 1 ? 'day' : 'days'}</span>
            </div>
            <div className={styles.stat}>
              <Flame size={18} className={styles.statIcon} data-tone="hot" aria-hidden="true" />
              <span className={`${styles.statValue} num`}>
                {insights.biggestDay ? formatINR(insights.biggestDay.spent) : '—'}
              </span>
              <span className={styles.statLabel}>
                {insights.biggestDay ? `worst day · ${formatDayShort(insights.biggestDay.date).split(', ')[1]}` : 'worst day'}
              </span>
            </div>
            <div className={styles.stat}>
              <TrendingDown size={18} className={styles.statIcon} data-tone="avg" aria-hidden="true" />
              <span className={`${styles.statValue} num`}>{formatINR(insights.dailyAverage)}</span>
              <span className={styles.statLabel}>a day, on average</span>
            </div>
          </m.section>

          {/* ── Latest evidence ── */}
          <m.section className={styles.recent} variants={rise} aria-labelledby="recent-title">
            <div className={styles.recentHead}>
              <h2 id="recent-title" className={styles.sectionTitle}>
                Latest evidence
              </h2>
              {txns.length > 0 && (
                <Link href="/history" className={styles.seeAll}>
                  See all <ArrowRight size={16} />
                </Link>
              )}
            </div>
            {recent.length ? (
              <ul className={styles.recentList}>
                {recent.map((t) => (
                  <li key={t.id}>
                    <TransactionRow tx={t} category={categories.get(t.categoryId)} account={accounts.get(t.accountId)} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nothing happened here." line="Suspicious." expression="suspicious" size={64} />
            )}
          </m.section>
        </div>
      </div>

      {isCurrent && <MonthRecap month={month} />}

      <MonthStartSheet month={month} open={adjusting} onClose={() => setAdjusting(false)} />
    </m.div>
  )
}
