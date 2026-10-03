import { AnimatePresence, m } from 'motion/react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearch } from 'wouter'
import { EmptyState } from '../components/EmptyState'
import { TransactionEvidence } from '../components/TransactionDetail'
import { TransactionRow } from '../components/TransactionRow'
import { Segmented } from '../components/ui/Segmented'
import { formatDayLong, monthName, relativeDayLabel } from '../lib/dates'
import { groupTransactionsByDay } from '../lib/finance'
import { formatINR, sumRupees } from '../lib/money'
import { useAccountMap, useCategoryMap, useMonth, useMonthTransactions, useToday } from '../state/selectors'
import { useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import styles from './HistoryPage.module.css'

type Filter = 'all' | 'expense' | 'income'

/** Room for the list and the evidence side by side (unfolded Fold, desktop). */
const SPLIT_AT = 700

function useSplit(ref: React.RefObject<HTMLElement | null>) {
  const [split, setSplit] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSplit(entry.contentRect.width >= SPLIT_AT))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return split
}

export default function HistoryPage() {
  const month = useMonth()
  const txns = useMonthTransactions(month)
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const allCategories = useData((s) => s.categories)
  const allAccounts = useData((s) => s.accounts)
  const today = useToday()
  const search = useSearch()
  const params = new URLSearchParams(search)
  const focusDay = params.get('day')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState(params.get('category') ?? '')
  const [accountId, setAccountId] = useState(params.get('account') ?? '')
  const pageRef = useRef<HTMLDivElement>(null)
  const split = useSplit(pageRef)
  const detailId = useUi((s) => s.detailId)

  // In split view the detail lives in the right column, not in a sheet.
  useEffect(() => {
    ui.setInlineDetail(split)
    return () => ui.setInlineDetail(false)
  }, [split])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return txns.filter((t) => {
      if (filter !== 'all' && t.type !== filter) return false
      if (categoryId && t.categoryId !== categoryId) return false
      if (accountId && t.accountId !== accountId) return false
      if (q) {
        const hay = `${t.description} ${categories.get(t.categoryId)?.name ?? ''} ${accounts.get(t.accountId)?.name ?? ''} ${t.note ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [txns, filter, categoryId, accountId, query, categories, accounts])

  const groups = useMemo(() => groupTransactionsByDay(visible), [visible])
  const spent = sumRupees(visible.filter((t) => t.type === 'expense').map((t) => t.amount))
  const received = sumRupees(visible.filter((t) => t.type === 'income').map((t) => t.amount))
  const selected = split ? (visible.find((t) => t.id === detailId) ?? groups[0]?.transactions[0]) : undefined

  // Arriving from the calendar: scroll to that day and make it glow.
  useEffect(() => {
    if (!focusDay) return
    const t = window.setTimeout(() => {
      document.getElementById(`day-${focusDay}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    return () => window.clearTimeout(t)
  }, [focusDay])

  const filtered = filter !== 'all' || Boolean(categoryId) || Boolean(accountId) || Boolean(query.trim())
  const clearAll = () => {
    setFilter('all')
    setCategoryId('')
    setAccountId('')
    setQuery('')
  }

  const list =
    groups.length === 0 ? (
      filter === 'income' && !categoryId && !accountId && !query.trim() ? (
        <EmptyState title="Nobody paid you. Tragic." line={`No money came in during ${monthName(month)}.`} expression="sleepy" />
      ) : filtered ? (
        <EmptyState title="Nothing matches." line="Either it didn’t happen, or someone’s hiding it." expression="suspicious" />
      ) : (
        <EmptyState title="Nothing to investigate yet." line={`No transactions in ${monthName(month)}.`} expression="suspicious" />
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
                      data-selected={selected?.id === t.id || undefined}
                      className={styles.item}
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
    )

  return (
    <div className={styles.page} ref={pageRef} data-split={split || undefined}>
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
            { value: 'income', label: 'Came in', color: 'var(--grass-400)' },
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
        <div className={styles.selects}>
          <SlidersHorizontal size={18} className={styles.selIcon} aria-hidden="true" />
          <label className={styles.select}>
            <span className="sr-only">Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Every category</option>
              <optgroup label="Spending">
                {allCategories
                  .filter((c) => c.kind === 'expense')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.archived ? ' (archived)' : ''}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Money in">
                {allCategories
                  .filter((c) => c.kind === 'income')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <label className={styles.select}>
            <span className="sr-only">Account</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Every account</option>
              {allAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.archived ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
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
        {filtered && (
          <button type="button" className={styles.clearAll} onClick={clearAll}>
            Clear filters
          </button>
        )}
      </p>

      {split ? (
        <div className={styles.split}>
          <div className={styles.listCol}>{list}</div>
          <aside className={styles.detailCol} aria-label="Selected transaction">
            {selected ? (
              <div className={styles.paper}>
                <TransactionEvidence key={selected.id} tx={selected} />
              </div>
            ) : (
              <p className={styles.pick}>Pick something to investigate.</p>
            )}
          </aside>
        </div>
      ) : (
        list
      )}
    </div>
  )
}
