import { AnimatePresence, m } from 'motion/react'
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Plus, StickyNote } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { accountKindMeta } from '../data/defaults'
import type { Transaction, TransactionDraft, TxType } from '../data/types'
import { addDays, formatDayLong, monthLabel, monthOf, toTimeKey, todayKey } from '../lib/dates'
import { calculateAccountBalance } from '../lib/finance'
import { formatINR, parseAmount, sanitizeAmountInput } from '../lib/money'
import { descriptionSuggestions, lastUsedAccount } from '../lib/suggestions'
import { hasErrors, validateTransaction, type FieldErrors } from '../lib/validation'
import { expressionForAmount } from '../mascot/engine'
import { MascotSpot } from '../mascot/MascotSpot'
import { react } from '../mascot/react'
import { useActiveAccounts, useCategories, useLedger } from '../state/selectors'
import { saveTransaction, useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import { CategoryEditor } from './CategoryEditor'
import styles from './TransactionComposer.module.css'
import { Button } from './ui/Button'
import { CategoryBadge } from './ui/CategoryBadge'
import form from './ui/Form.module.css'
import { DynamicIcon } from './ui/DynamicIcon'
import { Segmented } from './ui/Segmented'
import { Sheet } from './ui/Sheet'

interface FormState {
  type: TxType
  amount: string
  description: string
  categoryId: string
  accountId: string
  date: string
  time: string
  note: string
  showNote: boolean
}

function initialForm(
  editing: Transaction | undefined,
  preset: Partial<TransactionDraft> | null,
  txns: readonly Transaction[],
  fallbackAccount: string,
): FormState {
  if (editing) {
    return {
      type: editing.type,
      amount: String(editing.amount),
      description: editing.description,
      categoryId: editing.categoryId,
      accountId: editing.accountId,
      date: editing.date,
      time: editing.time,
      note: editing.note ?? '',
      showNote: Boolean(editing.note),
    }
  }
  const type = preset?.type ?? 'expense'
  const now = new Date()
  return {
    type,
    amount: preset?.amount ? String(preset.amount) : '',
    description: preset?.description ?? '',
    categoryId: preset?.categoryId ?? '',
    accountId: preset?.accountId ?? lastUsedAccount(txns, type) ?? fallbackAccount,
    date: preset?.date ?? todayKey(now),
    time: preset?.time ?? toTimeKey(now),
    note: '',
    showNote: false,
  }
}

const COPY = {
  expense: {
    title: 'Where’d it go?',
    what: 'What was it?',
    placeholder: 'McDonald’s',
    account: 'Paid from',
    submit: 'Add evidence',
  },
  income: {
    title: 'Money in!',
    what: 'Who paid you?',
    placeholder: 'Mom',
    account: 'Went to',
    submit: 'Add money',
  },
} as const

/** Add or edit a transaction. The main action of the app, so it's built for speed. */
export function TransactionComposer() {
  // A new key per opening gives every entry a fresh form without effects re-seeding state.
  const seq = useUi((s) => s.composer.seq)
  return <ComposerSheet key={seq} />
}

function ComposerSheet() {
  const composer = useUi((s) => s.composer)
  const transactions = useData((s) => s.transactions)
  const judginess = useData((s) => s.profile.prefs.judginess)
  const observer = useData((s) => s.viewer?.role === 'observer')
  const ledger = useLedger()
  const accounts = useActiveAccounts()
  const editing = composer.editId ? transactions.find((t) => t.id === composer.editId) : undefined

  const fallbackAccount = (accounts.find((a) => a.kind === 'bank') ?? accounts[0])?.id ?? ''
  const [f, setF] = useState<FormState>(() => initialForm(editing, composer.preset, transactions, fallbackAccount))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [overdraftOk, setOverdraftOk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const submitRef = useRef<HTMLButtonElement>(null)

  const categories = useCategories(f.type)
  // Keep an archived category visible when editing something filed under it.
  const editingCategory = useData((s) => s.categories.find((c) => c.id === f.categoryId))
  const categoryList =
    editingCategory && editingCategory.archived && editingCategory.kind === f.type ? [...categories, editingCategory] : categories
  const accountList = useMemo(() => {
    const current = ledger.accounts.find((a) => a.id === f.accountId)
    return current && current.archived ? [...accounts, current] : accounts
  }, [accounts, ledger.accounts, f.accountId])

  const amount = parseAmount(f.amount)
  const copy = editing ? { ...COPY[f.type], title: 'Fix the evidence', submit: 'Save changes' } : COPY[f.type]

  const suggestions = useMemo(
    () => descriptionSuggestions(transactions, f.type, f.description, 6),
    [transactions, f.type, f.description],
  )

  // Would this take the account below zero?
  const overdraft = useMemo(() => {
    if (f.type !== 'expense' || !f.accountId || !(amount > 0)) return null
    const others = editing ? ledger.transactions.filter((t) => t.id !== editing.id) : ledger.transactions
    const latest = [f.date, ...others.map((t) => t.date)].sort().pop() ?? f.date
    const before = calculateAccountBalance({ ...ledger, transactions: others }, f.accountId, latest)
    const after = before - amount
    if (after >= 0) return null
    const account = ledger.accounts.find((a) => a.id === f.accountId)
    return { before, after, name: account?.name ?? 'That account' }
  }, [f.type, f.accountId, f.date, amount, editing, ledger])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setF((prev) => ({ ...prev, [key]: value }))
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key as keyof FieldErrors]
        return next
      })
    }
    if (key === 'amount' || key === 'accountId') setOverdraftOk(false)
  }

  const switchType = (type: TxType) => {
    setF((prev) => ({
      ...prev,
      type,
      categoryId: '',
      accountId: editing ? prev.accountId : (lastUsedAccount(transactions, type) ?? prev.accountId),
    }))
    setErrors({})
  }

  const accountBalance = (id: string) => calculateAccountBalance(ledger, id, '9999-12-31')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const draft: TransactionDraft = {
      id: editing?.id,
      type: f.type,
      amount,
      description: f.description,
      categoryId: f.categoryId,
      accountId: f.accountId,
      date: f.date,
      time: f.time,
      note: f.showNote ? f.note : null,
    }
    const errs = validateTransaction(draft, {
      categories: [...categoryList],
      accounts: accountList,
    })
    if (hasErrors(errs)) {
      setErrors(errs)
      const first = Object.keys(errs)[0]
      document.getElementById(`composer-${first}`)?.focus()
      return
    }
    if (overdraft && !overdraftOk) {
      setOverdraftOk(true)
      return
    }
    setSaving(true)
    try {
      const { tx, created } = await saveTransaction(draft)
      const r = submitRef.current?.getBoundingClientRect()
      if (r) ui.burst(tx.type === 'expense' ? 'spent' : 'received', r.left + r.width / 2, r.top + r.height / 2)
      ui.closeComposer()
      const actor = useData.getState().viewer?.role
      window.setTimeout(() => react(created ? tx.type : 'edit', tx, { actor }), 320)
      const viewing = useUi.getState().month
      if (monthOf(tx.date) !== viewing) {
        ui.toast(`Saved to ${formatDayLong(tx.date)}.`, {
          action: { label: `Open ${monthLabel(monthOf(tx.date), false)}`, run: () => ui.setMonth(monthOf(tx.date)) },
        })
      }
    } catch {
      setSaving(false) // the store already showed what went wrong
    }
  }

  const today = todayKey()
  const yesterday = addDays(today, -1)
  const fontSize = f.amount.length > 9 ? 40 : f.amount.length > 6 ? 50 : 60

  return (
    <>
      <Sheet
        open={composer.open}
        onClose={ui.closeComposer}
        title={copy.title}
        tone={f.type === 'expense' ? 'spent' : 'received'}
        initialFocus={editing ? undefined : amountRef}
        adornment={
          <div className={styles.peek}>
            <MascotSpot
              pose="peek"
              expression={expressionForAmount(amount, f.type, judginess)}
              size={58}
              bubble="left"
              desktop
              pokeable={false}
              present={composer.open}
            />
          </div>
        }
        footer={
          <>
            <AnimatePresence>
              {overdraft && overdraftOk && (
                <m.p
                  className={styles.overdraft}
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {overdraft.name} only has {formatINR(overdraft.before)}. This takes it to {formatINR(overdraft.after)}.
                  Log it anyway?
                </m.p>
              )}
            </AnimatePresence>
            <Button
              ref={submitRef}
              type="submit"
              form="composer-form"
              variant={overdraft && overdraftOk ? 'danger' : 'primary'}
              size="lg"
              block
              disabled={saving}
            >
              {saving ? 'Saving…' : overdraft && overdraftOk ? 'Log it anyway' : copy.submit}
            </Button>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate id="composer-form" className={styles.form}>
          <Segmented
            label="Transaction type"
            size="lg"
            value={f.type}
            onChange={switchType}
            options={[
              {
                value: 'expense',
                color: 'var(--petal-400)',
                label: (
                  <>
                    <ArrowUpRight size={18} strokeWidth={3} /> Spent
                  </>
                ),
              },
              {
                value: 'income',
                color: 'var(--grass-400)',
                label: (
                  <>
                    <ArrowDownLeft size={18} strokeWidth={3} /> Received
                  </>
                ),
              },
            ]}
          />

          <div className={styles.amountWrap} data-type={f.type}>
            <label htmlFor="composer-amount" className="sr-only">
              Amount in rupees
            </label>
            <span className={styles.sign} aria-hidden="true">
              {f.type === 'expense' ? '−' : '+'}₹
            </span>
            <input
              ref={amountRef}
              id="composer-amount"
              className={styles.amount}
              style={{ fontSize }}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="next"
              placeholder="0"
              value={f.amount}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? 'err-amount' : undefined}
              onChange={(e) => set('amount', sanitizeAmountInput(e.target.value))}
            />
          </div>
          {errors.amount && (
            <p className={`${form.error} ${styles.center}`} id="err-amount">
              <CircleAlert size={16} /> {errors.amount}
            </p>
          )}

          <div className={form.field}>
            <label className={form.label} htmlFor="composer-description">
              {copy.what}
              <span className={form.labelAside}>optional</span>
            </label>
            <input
              id="composer-description"
              className={form.input}
              placeholder={copy.placeholder}
              value={f.description}
              maxLength={80}
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={Boolean(errors.description)}
              onChange={(e) => set('description', e.target.value)}
            />
            {suggestions.length > 0 && (
              <div className={form.chipsScroll} aria-label="Recent">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className={`${form.chip} ${form.chipPlain} ${styles.suggestion}`}
                    onClick={() =>
                      setF((prev) => ({
                        ...prev,
                        description: s.label,
                        categoryId: categoryList.some((c) => c.id === s.categoryId) ? s.categoryId : prev.categoryId,
                        accountId: accountList.some((a) => a.id === s.accountId) ? s.accountId : prev.accountId,
                      }))
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <fieldset className={`${form.field} ${form.fieldset}`}>
            <legend className={form.label}>Category</legend>
            <div className={form.chips} role="radiogroup" aria-label="Category" id="composer-categoryId" tabIndex={-1}>
              {categoryList.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={f.categoryId === c.id}
                  className={form.chip}
                  onClick={() => set('categoryId', c.id)}
                >
                  <CategoryBadge category={c} size={32} />
                  {c.name}
                </button>
              ))}
              {!observer && (
                <button type="button" className={`${form.chip} ${styles.newChip}`} onClick={() => setNewCategory(true)}>
                  <span className={form.chipIcon}>
                    <Plus size={18} strokeWidth={2.6} />
                  </span>
                  New
                </button>
              )}
            </div>
            {errors.categoryId && (
              <p className={form.error}>
                <CircleAlert size={16} /> {errors.categoryId}
              </p>
            )}
          </fieldset>

          <fieldset className={`${form.field} ${form.fieldset}`}>
            <legend className={form.label}>{copy.account}</legend>
            <div className={form.chips} role="radiogroup" aria-label={copy.account} id="composer-accountId" tabIndex={-1}>
              {accountList.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={f.accountId === a.id}
                    className={form.chip}
                    onClick={() => set('accountId', a.id)}
                  >
                    <span className={form.chipIcon} style={{ background: `var(--cat-${a.color})` }}>
                      <DynamicIcon name={accountKindMeta(a.kind).icon} size={17} strokeWidth={2.4} />
                    </span>
                    {a.name}
                  </button>
                ))}
            </div>
            {f.accountId && (
              <p className={form.hint}>
                {accountList.find((a) => a.id === f.accountId)?.name} has {formatINR(accountBalance(f.accountId))}
                {editing ? ' (including this one)' : ''}.
              </p>
            )}
            {errors.accountId && (
              <p className={form.error}>
                <CircleAlert size={16} /> {errors.accountId}
              </p>
            )}
          </fieldset>

          <fieldset className={`${form.field} ${form.fieldset}`}>
            <legend className={form.label}>When</legend>
            <div className={form.chips}>
              <button
                type="button"
                className={`${form.chip} ${form.chipPlain}`}
                aria-pressed={f.date === today}
                onClick={() => set('date', today)}
              >
                Today
              </button>
              <button
                type="button"
                className={`${form.chip} ${form.chipPlain}`}
                aria-pressed={f.date === yesterday}
                onClick={() => set('date', yesterday)}
              >
                Yesterday
              </button>
            </div>
            <div className={form.row}>
              <div>
                <label htmlFor="composer-date" className="sr-only">
                  Date
                </label>
                <input
                  id="composer-date"
                  type="date"
                  className={form.input}
                  value={f.date}
                  aria-invalid={Boolean(errors.date)}
                  onChange={(e) => set('date', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="composer-time" className="sr-only">
                  Time
                </label>
                <input
                  id="composer-time"
                  type="time"
                  className={form.input}
                  value={f.time}
                  aria-invalid={Boolean(errors.time)}
                  onChange={(e) => set('time', e.target.value)}
                />
              </div>
            </div>
            {(errors.date || errors.time) && (
              <p className={form.error}>
                <CircleAlert size={16} /> {errors.date ?? errors.time}
              </p>
            )}
          </fieldset>

          <div className={form.field}>
            {f.showNote ? (
              <>
                <label className={form.label} htmlFor="composer-note">
                  Note
                </label>
                <textarea
                  id="composer-note"
                  className={form.input}
                  value={f.note}
                  maxLength={280}
                  placeholder="the context she’ll ask about anyway"
                  onChange={(e) => set('note', e.target.value)}
                />
              </>
            ) : (
              <button type="button" className={styles.noteToggle} onClick={() => set('showNote', true)}>
                <StickyNote size={17} /> Add a note
              </button>
            )}
          </div>
        </form>
      </Sheet>

      <CategoryEditor
        open={newCategory}
        kind={f.type}
        onClose={() => setNewCategory(false)}
        onSaved={(c) => set('categoryId', c.id)}
      />
    </>
  )
}
