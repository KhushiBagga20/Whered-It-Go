import { MessageCircleHeart } from 'lucide-react'
import { memo } from 'react'
import type { Account, Category, Transaction } from '../data/types'
import { formatTime } from '../lib/dates'
import { unknownCategory } from '../lib/finance'
import { formatINR } from '../lib/money'
import { useData } from '../state/store'
import { ui } from '../state/ui'
import { CategoryBadge } from './ui/CategoryBadge'
import styles from './TransactionRow.module.css'

/** One line of evidence. Direction is carried by sign and colour, never colour alone. */
export const TransactionRow = memo(function TransactionRow({
  tx,
  category,
  account,
  showTime = true,
  tone = 'sky',
}: {
  tx: Transaction
  category: Category | undefined
  account: Account | undefined
  showTime?: boolean
  tone?: 'sky' | 'paper'
}) {
  const notes = useData((s) => s.comments.reduce((n, c) => n + (c.transactionId === tx.id ? 1 : 0), 0))
  const cat = category ?? unknownCategory(tx.categoryId, tx.type)
  const income = tx.type === 'income'
  const title = tx.description || cat.name
  return (
    <button
      type="button"
      className={styles.row}
      data-tone={tone}
      onClick={() => ui.showDetail(tx.id)}
      aria-label={`${income ? 'Received' : 'Spent'} ${formatINR(tx.amount)}, ${title}, ${cat.name}, ${formatTime(tx.time)}${notes ? `, ${notes} ${notes === 1 ? 'note' : 'notes'} from Khushi` : ''}`}
    >
      <CategoryBadge category={cat} size={42} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.meta}>
          {cat.name}
          {account && <> · {account.name}</>}
          {tx.note && <span className={styles.noteDot} aria-hidden="true" title="Has a note" />}
          {notes > 0 && (
            <span className={styles.khushi} aria-hidden="true" title="Khushi left a note">
              <MessageCircleHeart size={13} strokeWidth={2.6} />
              {notes > 1 && notes}
            </span>
          )}
        </span>
      </span>
      <span className={styles.right}>
        <span className={`${styles.amount} num`} data-type={tx.type}>
          {formatINR(income ? tx.amount : -tx.amount, { sign: 'always' })}
        </span>
        {showTime && <span className={styles.time}>{formatTime(tx.time)}</span>}
      </span>
    </button>
  )
})
