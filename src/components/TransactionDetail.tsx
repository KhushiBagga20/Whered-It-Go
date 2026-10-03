import { AnimatePresence, m } from 'motion/react'
import { MessageCircleHeart, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ActivityEntry, Transaction } from '../data/types'
import { formatDayLong, formatTime, relativeDayLabel, toDateKey, toTimeKey } from '../lib/dates'
import { unknownCategory } from '../lib/finance'
import { formatINR } from '../lib/money'
import { react } from '../mascot/react'
import { useAccountMap, useCategoryMap, useToday } from '../state/selectors'
import { addComment, deleteTransaction, loadActivity, restoreTransaction, useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import { Button } from './ui/Button'
import { CategoryBadge } from './ui/CategoryBadge'
import { Sheet } from './ui/Sheet'
import styles from './TransactionDetail.module.css'

/** Tap a transaction: see everything, edit it, comment on it, or (carefully) delete it. */
export function TransactionDetail() {
  const id = useUi((s) => s.detailId)
  const inline = useUi((s) => s.inlineDetail)
  const tx = useData((s) => (id ? s.transactions.find((t) => t.id === id) : undefined))
  // Keep showing the last one while the sheet animates out.
  const [shown, setShown] = useState<Transaction | undefined>(tx)
  if (tx && tx !== shown) setShown(tx)

  return (
    <Sheet open={Boolean(id && tx && !inline)} onClose={() => ui.showDetail(null)} title="The evidence" width={460}>
      {shown && <TransactionEvidence tx={shown} />}
    </Sheet>
  )
}

/** ISO timestamp → "9:03 PM" today, or "23 Sep, 9:03 PM". */
function when(iso: string, today: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const day = toDateKey(d)
  const time = formatTime(toTimeKey(d))
  return day === today ? time : `${relativeDayLabel(day, today).replace(/^\w+, /, '')}, ${time}`
}

/** The whole story of one transaction. Used in the sheet and in History's split view. */
export function TransactionEvidence({ tx }: { tx: Transaction }) {
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const members = useData((s) => s.members)
  const viewer = useData((s) => s.viewer)
  const allComments = useData((s) => s.comments)
  const comments = useMemo(() => allComments.filter((c) => c.transactionId === tx.id), [allComments, tx.id])
  const today = useToday()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const cat = categories.get(tx.categoryId) ?? unknownCategory(tx.categoryId, tx.type)
  const account = accounts.get(tx.accountId)
  const income = tx.type === 'income'
  const owner = viewer?.role === 'owner'
  const editor = tx.updatedBy && tx.updatedBy !== tx.createdBy ? members.find((mm) => mm.id === tx.updatedBy) : undefined

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
          {income ? 'Came in' : 'Went missing'}
        </span>
        <span className={`${styles.amount} num`} data-type={tx.type}>
          {formatINR(income ? tx.amount : -tx.amount, { sign: 'always' })}
        </span>
        <span className={styles.desc}>{tx.description || cat.name}</span>
        {editor && (
          <span className={styles.edited}>
            Edited by {editor.name} · {when(tx.updatedAt, today)}
          </span>
        )}
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

      <KhushiNotes tx={tx} comments={comments} />

      <div className={styles.actions} data-single={!owner || undefined}>
        <Button
          variant="secondary"
          size="lg"
          icon={<Pencil size={18} strokeWidth={2.4} />}
          onClick={() => {
            ui.showDetail(null)
            ui.editTransaction(tx.id)
          }}
        >
          {owner ? 'Edit' : 'Fix it'}
        </Button>
        {owner && (
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
        )}
      </div>
      {owner && confirming && comments.length > 0 && (
        <p className={styles.warn} role="alert">
          Khushi’s {comments.length === 1 ? 'note goes' : `${comments.length} notes go`} with it — Undo won’t bring {comments.length === 1 ? 'it' : 'them'} back.
        </p>
      )}

      <PaperTrail tx={tx} />
    </div>
  )
}

// ── Khushi's notes ─────────────────────────────────────────────────────

function KhushiNotes({ tx, comments }: { tx: Transaction; comments: ReturnType<typeof useData.getState>['comments'] }) {
  const viewer = useData((s) => s.viewer)
  const members = useData((s) => s.members)
  const today = useToday()
  const [writing, setWriting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const observer = viewer?.role === 'observer'
  const sorted = [...comments].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

  if (!observer && !sorted.length) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = text.trim()
    if (!clean) return
    setBusy(true)
    try {
      await addComment(tx.id, clean)
      setText('')
      setWriting(false)
      window.setTimeout(() => react('comment', tx, { actor: 'observer' }), 200)
    } catch {
      // the store already said what went wrong
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.notes} aria-label="Khushi’s notes">
      {sorted.map((c) => (
        <m.figure
          key={c.id}
          className={styles.noteCard}
          initial={{ opacity: 0, y: 10, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -1 }}
        >
          {/* user text is rendered as text — never as HTML */}
          <blockquote className={styles.noteText}>{c.comment}</blockquote>
          <figcaption className={styles.noteBy}>
            — {members.find((mm) => mm.id === c.authorId)?.name ?? 'Khushi'}, {when(c.createdAt, today)}
          </figcaption>
        </m.figure>
      ))}

      {observer &&
        (writing ? (
          <form className={styles.noteForm} onSubmit={submit}>
            <label htmlFor={`note-${tx.id}`} className="sr-only">
              Your note
            </label>
            <textarea
              id={`note-${tx.id}`}
              className={styles.noteInput}
              value={text}
              maxLength={500}
              rows={3}
              placeholder="you could’ve told me you were ordering this 😭"
              onChange={(e) => setText(e.target.value)}
              autoFocus
            />
            <div className={styles.noteActions}>
              <span className={styles.noteHint}>Permanent. He’ll see it.</span>
              <Button variant="ghost" size="sm" onClick={() => setWriting(false)}>
                Never mind
              </Button>
              <Button type="submit" size="sm" disabled={busy || !text.trim()}>
                {busy ? 'Pinning…' : 'Pin it'}
              </Button>
            </div>
          </form>
        ) : (
          <button type="button" className={styles.commentBtn} onClick={() => setWriting(true)}>
            <MessageCircleHeart size={18} /> {sorted.length ? 'Add another note' : 'Comment'}
          </button>
        ))}
      {observer && !sorted.length && !writing && <p className={styles.silent}>Khushi has remained suspiciously silent.</p>}
    </section>
  )
}

// ── Paper trail (activity log) ─────────────────────────────────────────

function PaperTrail({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const members = useData((s) => s.members)
  const categories = useCategoryMap()
  const accounts = useAccountMap()
  const today = useToday()

  useEffect(() => {
    if (!open || entries) return
    let cancelled = false
    loadActivity(tx.id)
      .then((list) => !cancelled && setEntries(list))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [open, entries, tx.id])

  const name = (id: string | null) => members.find((mm) => mm.id === id)?.name ?? 'Someone'
  const show = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—'
    if (field === 'amount') return formatINR(Number(v))
    if (field === 'category_id') return categories.get(String(v))?.name ?? 'a category'
    if (field === 'account_id') return accounts.get(String(v))?.name ?? 'an account'
    if (field === 'date') return formatDayLong(String(v))
    if (field === 'time') return formatTime(String(v).slice(0, 5))
    return `“${String(v)}”`
  }
  const LABEL: Record<string, string> = {
    amount: 'amount',
    type: 'type',
    category_id: 'category',
    account_id: 'account',
    description: 'description',
    date: 'date',
    time: 'time',
    note: 'note',
  }
  const describe = (e: ActivityEntry): string => {
    if (e.action === 'transaction_created') return `Added by ${name(e.actorId)}`
    if (e.action === 'comment_added') return `${name(e.actorId)} left a note`
    if (e.action === 'transaction_updated') {
      const changes = (e.metadata.changes ?? {}) as Record<string, [unknown, unknown]>
      const parts = Object.entries(changes).map(([f, [a, b]]) => `${LABEL[f] ?? f} ${show(f, a)} → ${show(f, b)}`)
      return `${name(e.actorId)} changed ${parts.join(', ') || 'it'}`
    }
    return `${name(e.actorId)}: ${e.action.replace(/_/g, ' ')}`
  }

  return (
    <details className={styles.trail} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Paper trail</summary>
      {error ? (
        <p className={styles.trailError}>Couldn’t load it. {error}</p>
      ) : !entries ? (
        <p className={styles.trailEmpty}>Digging through the evidence…</p>
      ) : entries.length === 0 ? (
        <p className={styles.trailEmpty}>No history recorded for this one yet.</p>
      ) : (
        <ol className={styles.trailList}>
          {entries.map((e) => (
            <li key={e.id}>
              <span>{describe(e)}</span>
              <time dateTime={e.createdAt}>{when(e.createdAt, today)}</time>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
