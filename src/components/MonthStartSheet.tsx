import { CircleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import { useOpenKey } from '../hooks/useOpenKey'
import { accountKindMeta } from '../data/defaults'
import type { MonthKey } from '../data/types'
import { addMonths, monthLabel, monthName } from '../lib/dates'
import { formatINR, fromPaise, parseAmount, sanitizeAmountInput, toPaise } from '../lib/money'
import { useActiveAccounts, useMonthSummary } from '../state/selectors'
import { setMonthAdjustment, useData } from '../state/store'
import { ui } from '../state/ui'
import { Button } from './ui/Button'
import form from './ui/Form.module.css'
import { DynamicIcon } from './ui/DynamicIcon'
import { Sheet } from './ui/Sheet'
import styles from './MonthStartSheet.module.css'

/**
 * "Actually, September started with ₹8,300." Rollover is automatic; this
 * records the difference against one account so the dashboard and the
 * account balances keep agreeing.
 */
interface MonthStartSheetProps {
  month: MonthKey
  open: boolean
  onClose: () => void
}

export function MonthStartSheet(props: MonthStartSheetProps) {
  return <MonthStartBody key={useOpenKey(props.open)} {...props} />
}

function MonthStartBody({ month, open, onClose }: MonthStartSheetProps) {
  const summary = useMonthSummary(month)
  const accounts = useActiveAccounts()
  const setting = useData((s) => s.monthSettings.find((m) => m.month === month))
  const startMonth = useData((s) => s.profile.startMonth)
  const [value, setValue] = useState(String(summary.starting))
  const [accountId, setAccountId] = useState(
    setting?.adjustmentAccountId ?? (accounts.find((a) => a.kind === 'cash') ?? accounts[0])?.id ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const desired = parseAmount(value)
  const diff = Number.isNaN(desired) ? 0 : fromPaise(toPaise(desired) - toPaise(summary.rolledOver))
  const firstMonth = month <= startMonth
  const account = accounts.find((a) => a.id === accountId)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (Number.isNaN(desired) || desired < 0) {
      setError('Enter what the month actually started with (₹0 or more).')
      return
    }
    if (diff !== 0 && !account) {
      setError('Pick which account the difference belongs to.')
      return
    }
    setSaving(true)
    try {
      await setMonthAdjustment(month, diff, diff === 0 ? null : accountId)
      ui.toast(`${monthName(month)} now starts with ${formatINR(desired)}.`, { tone: 'success' })
      onClose()
    } catch {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    try {
      await setMonthAdjustment(month, 0, null)
      ui.toast(`${monthName(month)} rolls over again: ${formatINR(summary.rolledOver)}.`)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${monthName(month)}’s starting balance`}
      initialFocus={inputRef}
      width={460}
      footer={
        <div className={styles.footer}>
          {setting && (
            <Button variant="ghost" onClick={reset} disabled={saving}>
              Undo adjustment
            </Button>
          )}
          <Button type="submit" form="start-form" size="lg" block disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      <form id="start-form" onSubmit={save} noValidate>
        <p className={styles.lede}>
          {firstMonth ? (
            <>Your accounts opened with {formatINR(summary.rolledOver)} in total.</>
          ) : (
            <>
              {monthLabel(addMonths(month, -1), false)} ended with <strong>{formatINR(summary.rolledOver)}</strong>, so{' '}
              {monthName(month)} starts there automatically.
            </>
          )}{' '}
          If the real number was different, fix it here.
        </p>
        <div className={form.field}>
          <label className={form.label} htmlFor="start-amount">
            Actually started with
          </label>
          <input
            ref={inputRef}
            id="start-amount"
            className={form.input}
            inputMode="decimal"
            value={value}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setValue(sanitizeAmountInput(e.target.value))
              setError(null)
            }}
          />
        </div>
        {diff !== 0 && (
          <fieldset className={`${form.field} ${form.fieldset}`}>
            <legend className={form.label}>Where’s the difference?</legend>
            <div className={form.chips} role="radiogroup" aria-label="Account for the difference">
              {accounts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={accountId === a.id}
                    className={form.chip}
                    onClick={() => setAccountId(a.id)}
                  >
                    <span className={form.chipIcon} style={{ background: `var(--cat-${a.color})` }}>
                      <DynamicIcon name={accountKindMeta(a.kind).icon} size={17} />
                    </span>
                    {a.name}
                  </button>
                ))}
            </div>
            <p className={form.hint}>
              {formatINR(Math.abs(diff))} {diff > 0 ? 'gets added to' : 'comes out of'} {account?.name ?? 'that account'} at the
              start of {monthName(month)}. Not counted as spending or income.
            </p>
          </fieldset>
        )}
        {error && (
          <p className={form.error} role="alert" style={{ marginTop: 12 }}>
            <CircleAlert size={16} /> {error}
          </p>
        )}
      </form>
    </Sheet>
  )
}
