import { m } from 'motion/react'
import { ArrowRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'wouter'
import type { DateKey } from '../data/types'
import { formatDayLong, monthOf, weekdayOf } from '../lib/dates'
import { calculateDailySpending } from '../lib/finance'
import { formatINR } from '../lib/money'
import { useAccountMap, useCategoryMap, useToday } from '../state/selectors'
import { useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import styles from './DaySheet.module.css'
import { EmptyState } from './EmptyState'
import { TransactionRow } from './TransactionRow'
import { Button } from './ui/Button'
import { CategoryBadge } from './ui/CategoryBadge'
import { catColor } from './ui/palette'
import { Sheet } from './ui/Sheet'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** One day, up close: how much, on what, and every transaction. */
export function DaySheet() {
  const day = useUi((s) => s.day)
  // Keep rendering the last day while the sheet animates closed.
  const [shown, setShown] = useState<DateKey | null>(day)
  if (day && day !== shown) setShown(day)
  return (
    <Sheet
      open={Boolean(day)}
      onClose={() => ui.showDay(null)}
      title={shown ? formatDayLong(shown) : 'Day'}
      hideTitle
      width={480}
    >
      {shown && <DayBody date={shown} />}
    </Sheet>
  )
}

function DayBody({ date }: { date: DateKey }) {
  const txns = useData((s) => s.transactions)
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const today = useToday()
  const [, navigate] = useLocation()
  const activity = calculateDailySpending(
    txns.filter((t) => t.date === date),
    monthOf(date),
  ).get(date)!
  const owner = useData((s) => s.viewer?.role !== 'observer')
  const future = date > today
  const expenseCount = activity.transactions.filter((t) => t.type === 'expense').length

  return (
    <div className={styles.body}>
      <div className={styles.head}>
        <span className={styles.weekday}>{date === today ? 'Today' : WEEKDAYS[weekdayOf(date)]}</span>
        <h3 className={styles.date}>{formatDayLong(date)}</h3>
      </div>

      <div className={styles.totals}>
        <div className={styles.total}>
          <span className={styles.totalLabel}>Spent</span>
          <span className={`${styles.totalValue} num`} data-type="expense">
            {formatINR(activity.spent)}
          </span>
        </div>
        {activity.received > 0 && (
          <div className={styles.total}>
            <span className={styles.totalLabel}>Received</span>
            <span className={`${styles.totalValue} num`} data-type="income">
              {formatINR(activity.received, { sign: 'always' })}
            </span>
          </div>
        )}
      </div>

      {activity.byCategory.length > 0 && (
        <ul className={styles.breakdown} aria-label="Spent by category">
          {activity.byCategory.map((c, i) => {
            const cat = categories.get(c.categoryId)
            return (
              <li key={c.categoryId}>
                <CategoryBadge category={cat} size={30} />
                <span className={styles.catName}>{cat?.name ?? 'Unknown'}</span>
                <span className={styles.catBar} aria-hidden="true">
                  <m.span
                    style={{ background: catColor(cat?.color ?? 0) }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: c.total / activity.spent }}
                    transition={{ type: 'spring', stiffness: 160, damping: 22, delay: 0.1 + i * 0.05 }}
                  />
                </span>
                <span className={`${styles.catAmt} num`}>{formatINR(c.total)}</span>
              </li>
            )
          })}
        </ul>
      )}

      {activity.transactions.length ? (
        <ul className={styles.list}>
          {activity.transactions.map((t) => (
            <li key={t.id}>
              <TransactionRow
                tx={t}
                category={categories.get(t.categoryId)}
                account={accounts.get(t.accountId)}
                tone="paper"
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          tone="paper"
          title={future ? 'Hasn’t happened yet.' : date === today ? 'Nothing yet.' : 'Peaceful.'}
          line={future ? 'The future is unspent.' : 'Not a single rupee. Character development?'}
          expression={future ? 'sleepy' : 'proud'}
          size={72}
        />
      )}

      <div className={styles.actions}>
        {expenseCount + (activity.received > 0 ? 1 : 0) > 0 && (
          <Button
            variant="secondary"
            onClick={() => {
              ui.showDay(null)
              ui.setMonth(monthOf(date))
              navigate(`/history?day=${date}`, { replace: true })
            }}
            icon={<ArrowRight size={18} />}
          >
            View transactions
          </Button>
        )}
        {owner && (
          <Button
            variant="primary"
            onClick={() => {
              ui.showDay(null)
              ui.openComposer({ date })
            }}
            icon={<Plus size={18} strokeWidth={3} />}
          >
            Add for this day
          </Button>
        )}
      </div>
    </div>
  )
}
