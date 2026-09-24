import { AnimatePresence, m } from 'motion/react'
import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Transaction } from '../data/types'
import { formatDayLong, formatTime, relativeDayLabel } from '../lib/dates'
import { unknownCategory } from '../lib/finance'
import { formatINR } from '../lib/money'
import { react } from '../mascot/react'
import { useAccountMap, useCategoryMap, useToday } from '../state/selectors'
import { deleteTransaction, restoreTransaction, useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import { Button } from './ui/Button'
import { CategoryBadge } from './ui/CategoryBadge'
import { Sheet } from './ui/Sheet'
import styles from './TransactionDetail.module.css'

/** Tap a transaction: see everything, edit it, or (carefully) delete it. */
export function TransactionDetail() {
  const id = useUi((s) => s.detailId)
  const tx = useData((s) => (id ? s.transactions.find((t) => t.id === id) : undefined))
  // Keep showing the last one while the sheet animates out.
  const [shown, setShown] = useState<Transaction | undefined>(tx)
  if (tx && tx !== shown) setShown(tx)

  return (
    <Sheet open={Boolean(id && tx)} onClose={() => ui.showDetail(null)} title="The evidence" width={440}>
      {shown && <DetailBody tx={shown} />}
    </Sheet>
  )
}

function DetailBody({ tx }: { tx: Transaction }) {
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const today = useToday()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const cat = categories.get(tx.categoryId) ?? unknownCategory(tx.categoryId, tx.type)
  const account = accounts.get(tx.accountId)
  const income = tx.type === 'income'

  useEffect(() => {
    if (!confirming) return
    const t = window.setTimeout(() => setConfirming(false), 3500)
    return () => window.clearTimeout(t)
  }, [confirming])

  const onDelete = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setBusy(true)
    try {
      const removed = await deleteTransaction(tx.id)
      ui.showDetail(null)
      if (removed) {
        ui.toast(`Deleted ${formatINR(removed.amount)}${removed.description ? ` · ${removed.description}` : ''}.`, {
          action: { label: 'Undo', run: () => void restoreTransaction(removed) },
        })
        window.setTimeout(() => react('delete'), 300)
      }
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className={styles.body}>
      <div className={styles.hero}>
        <span className={styles.kind} data-type={tx.type}>
          {income ? 'Received' : 'Spent'}
        </span>
        <span className={`${styles.amount} num`} data-type={tx.type}>
          {formatINR(income ? tx.amount : -tx.amount, { sign: 'always' })}
        </span>
        <span className={styles.desc}>{tx.description || cat.name}</span>
      </div>

      <dl className={styles.facts}>
        <div>
          <dt>Category</dt>
          <dd>
            <CategoryBadge category={cat} size={28} /> {cat.name}
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>
            {formatDayLong(tx.date, true)} · {formatTime(tx.time)}
            <span className={styles.rel}>{relativeDayLabel(tx.date, today)}</span>
          </dd>
        </div>
        <div>
          <dt>{income ? 'Went to' : 'Paid from'}</dt>
          <dd>{account?.name ?? 'Unknown account'}</dd>
        </div>
      </dl>

      {tx.note && <p className={styles.note}>{tx.note}</p>}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="lg"
          icon={<Pencil size={18} strokeWidth={2.4} />}
          onClick={() => {
            ui.showDetail(null)
            ui.editTransaction(tx.id)
          }}
        >
          Edit
        </Button>
        <Button
          variant={confirming ? 'danger' : 'secondary'}
          size="lg"
          disabled={busy}
          onClick={onDelete}
          icon={<Trash2 size={18} strokeWidth={2.4} />}
          aria-live="polite"
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={confirming ? 'sure' : 'delete'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.14 }}
              style={{ display: 'inline-block' }}
            >
              {busy ? 'Deleting…' : confirming ? 'Tap again to delete' : 'Delete'}
            </m.span>
          </AnimatePresence>
        </Button>
      </div>
    </div>
  )
}
