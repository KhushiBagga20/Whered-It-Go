import { Archive, ArchiveRestore, CircleAlert, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useOpenKey } from '../hooks/useOpenKey'
import { ACCOUNT_KINDS, buildAccount } from '../data/defaults'
import type { Account, AccountKind } from '../data/types'
import { lastDayOfMonth, monthLabel } from '../lib/dates'
import { calculateAccountBalance, openingBalanceFor } from '../lib/finance'
import { formatINR, fromPaise, parseAmount, sanitizeAmountInput, toPaise } from '../lib/money'
import { validateName } from '../lib/validation'
import { useLedger, useToday } from '../state/selectors'
import { removeAccount, saveAccount, useData } from '../state/store'
import { ui } from '../state/ui'
import { Button } from './ui/Button'
import form from './ui/Form.module.css'
import { DynamicIcon } from './ui/DynamicIcon'
import { Sheet } from './ui/Sheet'
import styles from './AccountEditor.module.css'

interface AccountEditorProps {
  open: boolean
  onClose: () => void
  account?: Account
}

/** Add or edit a place money lives: Bank / UPI, Cash, a wallet… */
export function AccountEditor(props: AccountEditorProps) {
  return <AccountEditorSheet key={useOpenKey(props.open)} {...props} />
}

function AccountEditorSheet({ open, onClose, account }: AccountEditorProps) {
  const accounts = useData((s) => s.accounts)
  const startMonth = useData((s) => s.profile.startMonth)
  const used = useData((s) =>
    account
      ? s.transactions.some((t) => t.accountId === account.id) || s.monthSettings.some((m) => m.adjustmentAccountId === account.id)
      : false,
  )
  const ledger = useLedger()
  const month = useToday().slice(0, 7)
  // What the Money page shows for this account today.
  const current = account ? calculateAccountBalance(ledger, account.id, lastDayOfMonth(month)) : 0
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'wallet')
  // A new account: what it opened with. An existing one: what's in it right now.
  const [amount, setAmount] = useState(account ? String(current) : '')
  const [amountEdited, setAmountEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const typed = amount.trim() === '' ? 0 : parseAmount(amount)
  const correction = account && amountEdited && !Number.isNaN(typed) ? fromPaise(toPaise(typed) - toPaise(current)) : 0

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateName(
      name,
      accounts.filter((a) => a.id !== account?.id && !a.archived).map((a) => a.name),
      'account',
    )
    if (problem) {
      setError(problem)
      nameRef.current?.focus()
      return
    }
    if (Number.isNaN(typed)) {
      setError(account ? 'The amount needs to be a number.' : 'The opening balance needs to be a number.')
      return
    }
    setSaving(true)
    // Typing a new amount corrects what the account started with; a rename alone leaves the money alone.
    const next: Account = account
      ? {
          ...account,
          name: name.trim(),
          kind,
          openingBalance: amountEdited ? openingBalanceFor(ledger, account.id, month, typed) : account.openingBalance,
        }
      : buildAccount(name.trim(), kind, typed, Math.max(-1, ...accounts.map((a) => a.sortOrder)) + 1)
    try {
      await saveAccount(next)
      if (account && next.openingBalance !== account.openingBalance) {
        ui.toast(`${next.name} now has ${formatINR(typed)}.`, { tone: 'success' })
      }
      onClose()
    } catch {
      setSaving(false)
    }
  }

  const archiveOrDelete = async () => {
    if (!account) return
    if (account.archived) {
      await saveAccount({ ...account, archived: false })
      ui.toast(`${account.name} is back.`)
      onClose()
      return
    }
    const result = await removeAccount(account.id)
    ui.toast(result === 'deleted' ? `${account.name} deleted.` : `${account.name} archived. Its history stays.`)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={account ? `Edit ${account.name}` : 'New place for money'}
      initialFocus={account ? amountRef : nameRef}
      width={480}
      footer={
        <div className={styles.footer}>
          {account && (
            <Button
              variant="ghost"
              onClick={archiveOrDelete}
              icon={account.archived ? <ArchiveRestore size={18} /> : used ? <Archive size={18} /> : <Trash2 size={18} />}
            >
              {account.archived ? 'Restore' : used ? 'Archive' : 'Delete'}
            </Button>
          )}
          <Button type="submit" form="account-form" size="lg" block disabled={saving}>
            {saving ? 'Saving…' : account ? 'Save' : 'Add account'}
          </Button>
        </div>
      }
    >
      <form id="account-form" onSubmit={save} noValidate>
        <fieldset className={`${form.field} ${form.fieldset}`} style={{ marginTop: 4 }}>
          <legend className={form.label}>Type</legend>
          <div className={form.chips} role="radiogroup" aria-label="Account type">
            {ACCOUNT_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.kind}
                  className={form.chip}
                  onClick={() => {
                    setKind(k.kind)
                    if (!name.trim() || ACCOUNT_KINDS.some((x) => x.label === name.trim())) setName(k.label)
                  }}
                >
                  <span className={form.chipIcon} style={{ background: `var(--cat-${k.color})` }}>
                    <DynamicIcon name={k.icon} size={17} />
                  </span>
                  {k.label}
                </button>
              ))}
          </div>
        </fieldset>
        <div className={form.field}>
          <label className={form.label} htmlFor="account-name">
            Name
          </label>
          <input
            ref={nameRef}
            id="account-name"
            className={form.input}
            value={name}
            maxLength={24}
            placeholder="Paytm wallet"
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div className={form.field}>
          <label className={form.label} htmlFor="account-opening">
            {account ? 'In it right now' : `Had at the start of ${monthLabel(startMonth, false)}`}
          </label>
          <input
            ref={amountRef}
            id="account-opening"
            className={form.input}
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onFocus={account ? (e) => e.target.select() : undefined}
            onChange={(e) => {
              setAmount(sanitizeAmountInput(e.target.value))
              setAmountEdited(true)
              setError(null)
            }}
          />
          <p className={form.hint}>
            {!account
              ? 'Everything since then is worked out from your transactions.'
              : correction !== 0
                ? `${formatINR(correction, { sign: 'always' })} correction to what ${account.name} started with. Not counted as money in or as spending.`
                : 'Type what’s really in there. The difference isn’t counted as money in or as spending.'}
          </p>
        </div>
        {error && (
          <p className={form.error} role="alert" style={{ marginTop: 12 }}>
            <CircleAlert size={16} /> {error}
          </p>
        )}
      </form>
    </Sheet>
  )
}
