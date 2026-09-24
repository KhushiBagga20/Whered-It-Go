import { AnimatePresence, m } from 'motion/react'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { EmptyState } from '../components/EmptyState'
import { TransactionRow } from '../components/TransactionRow'
import { Segmented } from '../components/ui/Segmented'
import { CategoryBadge } from '../components/ui/CategoryBadge'
import { formatDayLong, monthName, relativeDayLabel } from '../lib/dates'
import { groupTransactionsByDay } from '../lib/finance'
import { formatINR, sumRupees } from '../lib/money'
import { useAccountMap, useCategoryMap, useMonth, useMonthTransactions, useToday } from '../state/selectors'
import { ui } from '../state/ui'
import styles from './HistoryPage.module.css'

type Filter = 'all' | 'expense' | 'income'

export default function HistoryPage() {
  const month = useMonth()
  const txns = useMonthTransactions(month)
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const today = useToday()
  const search = useSearch()
  const [, navigate] = useLocation()
  const params = new URLSearchParams(search)
  const categoryId = params.get('category')
  const focusDay = params.get('day')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const category = categoryId ? categories.get(categoryId) : undefined

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return txns.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false
      if (categoryId && t.categoryId !== categoryId) return false
      if (q) {
        const hay = `${t.description} ${categories.get(t.categoryId)?.name ?? ''} ${t.note ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [txns, filter, categoryId, query, categories])

  const groups = useMemo(() => groupTransactionsByDay(visible), [visible])
  const spent = sumRupees(visible.filter((t) => t.type === 'expense').map((t) => t.amount))
  const received = sumRupees(visible.filter((t) => t.type === 'income').map((t) => t.amount))

  // Arriving from the calendar: scroll to that day and make it glow.
  useEffect(() => {
    if (!focusDay) return
    const t = window.setTimeout(() => {
      document.getElementById(`day-${focusDay}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    return () => window.clearTimeout(t)
  }, [focusDay])

  const clearCategory = () => navigate('/history', { replace: true })
  const filtered = filter !== 'all' || Boolean(categoryId) || Boolean(query.trim())

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">{monthName(month)}</p>
        <h1 className={styles.title}>Where the money went</h1>
      </header>

      <div className={styles.controls}>
        <Segmented<Filter>
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Spent', color: 'var(--petal-400)' },
            { value: 'income', label: 'Received', color: 'var(--grass-400)' },
          ]}
        />
        <label className={styles.search}>
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search transactions</span>
          <input
            type="search"
            value={query}
            placeholder="Search “zomato”, “auto”…"
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className={styles.clear}>
              <X size={16} />
            </button>
          )}
        </label>
        {categoryId && (
          <button type="button" className={styles.catChip} onClick={clearCategory}>
            <CategoryBadge category={category} size={26} />
            {category?.name ?? 'Category'} only
            <X size={16} aria-label="Remove filter" />
          </button>
        )}
      </div>

      <p className={styles.tally} aria-live="polite">
        {visible.length} {visible.length === 1 ? 'transaction' : 'transactions'}
        {spent > 0 && (
          <>
            {' · '}
            <span className={styles.out}>{formatINR(-spent)}</span>
          </>
        )}
        {received > 0 && (
          <>
            {' · '}
            <span className={styles.in}>{formatINR(received, { sign: 'always' })}</span>
          </>
        )}
      </p>

      {groups.length === 0 ? (
        filter === 'income' && !categoryId && !query.trim() ? (
          <EmptyState title="Nobody paid you. Tragic." line={`No money came in during ${monthName(month)}.`} expression="sleepy" />
        ) : filtered ? (
          <EmptyState title="Nothing matches." line="Either it didn’t happen, or you’re hiding it." expression="suspicious" />
        ) : (
          <EmptyState
            title="Nothing happened here. Suspicious."
            line={`No transactions in ${monthName(month)}.`}
            expression="suspicious"
          />
        )
      ) : (
        <div className={styles.groups}>
          <AnimatePresence initial={false}>
            {groups.map((g) => (
              <m.section
                key={g.date}
                id={`day-${g.date}`}
                layout="position"
                className={styles.group}
                data-focus={focusDay === g.date || undefined}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                aria-label={formatDayLong(g.date)}
              >
                <button type="button" className={styles.dayHead} onClick={() => ui.showDay(g.date)}>
                  <span className={styles.dayLabel}>{relativeDayLabel(g.date, today)}</span>
                  <span className={styles.dayTotals}>
                    {g.spent > 0 && <span className={styles.out}>{formatINR(-g.spent)}</span>}
                    {g.received > 0 && <span className={styles.in}>{formatINR(g.received, { sign: 'always' })}</span>}
                  </span>
                </button>
                <ul className={styles.list}>
                  <AnimatePresence initial={false}>
                    {g.transactions.map((t) => (
                      <m.li
                        key={t.id}
                        layout="position"
                        initial={{ opacity: 0, x: 30, scale: 0.96 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -80, transition: { duration: 0.22 } }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      >
                        <TransactionRow tx={t} category={categories.get(t.categoryId)} account={accounts.get(t.accountId)} />
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </m.section>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
