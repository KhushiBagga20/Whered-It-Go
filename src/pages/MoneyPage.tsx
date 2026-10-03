import { m } from 'motion/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AccountCard } from '../components/AccountCard'
import { AccountEditor } from '../components/AccountEditor'
import { EmptyState } from '../components/EmptyState'
import { MonthStartSheet } from '../components/MonthStartSheet'
import { TransactionRow } from '../components/TransactionRow'
import { catColor } from '../components/ui/palette'
import { MoneyDisplay } from '../components/ui/MoneyDisplay'
import type { Account } from '../data/types'
import { monthName } from '../lib/dates'
import { calculateTotalAvailable, compareTransactionsDesc } from '../lib/finance'
import { formatINR } from '../lib/money'
import { MascotSpot } from '../mascot/MascotSpot'
import {
  useAccountMap,
  useAccountPositions,
  useCategoryMap,
  useMonth,
  useMonthSummary,
  useMonthTransactions,
  useToday,
} from '../state/selectors'
import { useData } from '../state/store'
import styles from './MoneyPage.module.css'

export default function MoneyPage() {
  const month = useMonth()
  const today = useToday()
  const positions = useAccountPositions(month)
  const summary = useMonthSummary(month)
  const txns = useMonthTransactions(month)
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const [editing, setEditing] = useState<Account | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const owner = useData((s) => s.viewer?.role !== 'observer')

  const active = positions.filter((p) => !p.account.archived).sort((a, b) => a.account.sortOrder - b.account.sortOrder)
  const archived = positions.filter((p) => p.account.archived)
  const total = calculateTotalAvailable(positions)
  const incoming = txns.filter((t) => t.type === 'income').sort(compareTransactionsDesc)
  const current = today.slice(0, 7) === month
  const past = month < today.slice(0, 7)

  const openEditor = (a?: Account) => {
    setEditing(a)
    setEditorOpen(true)
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">{current ? 'Where it’s sitting right now' : past ? `Where it sat, end of ${monthName(month)}` : 'Where it’ll start'}</p>
        <div className={styles.totalRow}>
          <MoneyDisplay value={total} className={`${styles.total} num`} />
          <div className={styles.mascot}>
            <MascotSpot pose="sit" expression={total < summary.starting ? 'judging' : 'happy'} size={50} bubble="left" />
          </div>
        </div>
        <p className={styles.sub}>total available across {active.length} {active.length === 1 ? 'place' : 'places'}</p>
      </header>

      {total > 0 && (
        <div className={styles.jar} role="img" aria-label={active.map((p) => `${p.account.name} ${Math.round(p.share * 100)}%`).join(', ')}>
          {active
            .filter((p) => p.share > 0)
            .map((p, i) => (
              <m.span
                key={p.account.id}
                className={styles.jarSeg}
                style={{ background: catColor(p.account.color) }}
                initial={{ flexGrow: 0 }}
                animate={{ flexGrow: p.share }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, delay: i * 0.06 }}
              >
                {p.share > 0.14 && <span className={styles.jarLabel}>{p.account.name}</span>}
              </m.span>
            ))}
        </div>
      )}

      {active.length === 0 && (
        <EmptyState
          title="Where are we keeping the money?"
          line={owner ? 'Add a bank, UPI or cash pocket below.' : 'Jais hasn’t added any accounts yet.'}
          expression="suspicious"
          size={64}
        />
      )}

      <div className={styles.cards}>
        {active.map((p, i) => (
          <AccountCard key={p.account.id} position={p} index={i} onClick={owner ? () => openEditor(p.account) : undefined} />
        ))}
        {owner && (
          <button type="button" className={styles.add} onClick={() => openEditor()}>
            <Plus size={22} strokeWidth={3} /> Add a place
          </button>
        )}
      </div>

      <button type="button" className={styles.start} onClick={() => setAdjusting(true)} disabled={!owner}>
        <span>
          {monthName(month)} started with <strong className="num">{formatINR(summary.starting)}</strong>
          {summary.adjustment !== 0 && (
            <span className={styles.adj}> (adjusted {formatINR(summary.adjustment, { sign: 'always' })})</span>
          )}
        </span>
        {owner && <span className={styles.startCta}>Adjust</span>}
      </button>

      <section aria-labelledby="money-in">
        <h2 id="money-in" className={styles.sectionTitle}>
          Money in · <span className={`${styles.inTotal} num`}>{formatINR(summary.received, { sign: 'always' })}</span>
        </h2>
        {incoming.length ? (
          <ul className={styles.list}>
            {incoming.map((t) => (
              <li key={t.id}>
                <TransactionRow tx={t} category={categories.get(t.categoryId)} account={accounts.get(t.accountId)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nobody paid you. Tragic." line={`Nothing came in during ${monthName(month)}.`} expression="sleepy" size={64} />
        )}
      </section>

      {archived.length > 0 && (
        <details className={styles.archived}>
          <summary>
            Archived ({archived.length}) · {formatINR(calculateTotalAvailable(archived))}
          </summary>
          <div className={styles.cards}>
            {archived.map((p, i) => (
              <AccountCard key={p.account.id} position={p} index={i} onClick={owner ? () => openEditor(p.account) : undefined} />
            ))}
          </div>
        </details>
      )}

      <AccountEditor open={editorOpen} account={editing} onClose={() => setEditorOpen(false)} />
      <MonthStartSheet month={month} open={adjusting} onClose={() => setAdjusting(false)} />
    </div>
  )
}
