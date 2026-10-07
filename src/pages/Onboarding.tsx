import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'wouter'
import { LogoMark, Wordmark } from '../components/Brand'
import { Button } from '../components/ui/Button'
import form from '../components/ui/Form.module.css'
import { DynamicIcon } from '../components/ui/DynamicIcon'
import { currentMonthKey, monthName } from '../lib/dates'
import { formatINR, parseAmount, sanitizeAmountInput, sumRupees } from '../lib/money'
import { Mascot } from '../mascot/Mascot'
import { completeOnboarding, useData } from '../state/store'
import styles from './Onboarding.module.css'

const SOURCES = [
  { key: 'bank', label: 'Bank / UPI', icon: 'landmark', color: 8 },
  { key: 'cash', label: 'Cash', icon: 'banknote', color: 3 },
] as const

/** First run: who you are and what this month started with. That's it. */
export default function Onboarding() {
  const mode = useData((s) => s.mode)
  const mascotName = useData((s) => s.profile.mascotName) || 'Khushi'
  const month = currentMonthKey()
  const [, navigate] = useLocation()
  const [name, setName] = useState('')
  const [values, setValues] = useState({ bank: '', cash: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null)

  const amounts = {
    bank: values.bank ? parseAmount(values.bank) : 0,
    cash: values.cash ? parseAmount(values.cash) : 0,
  }
  const total = sumRupees(Object.values(amounts).map((v) => (Number.isNaN(v) ? 0 : v)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (Object.values(amounts).some((v) => Number.isNaN(v))) {
      setError({ message: 'Amounts need to be numbers (or empty).' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      navigate('/', { replace: true })
      await completeOnboarding({ displayName: name, mascotName, startMonth: month, balances: amounts })
    } catch (err) {
      setError({ message: 'Couldn’t set things up.', detail: err instanceof Error ? err.message : String(err) })
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <LogoMark size={52} />
        <Wordmark />
      </div>
      <div className={styles.intro}>
        <Mascot pose="wave" expression="happy" size={120} />
        <h1 className={styles.title}>hi. i’m tiny {mascotName.toLowerCase()}.</h1>
        <p className={styles.lede}>I made this so we can finally find out where your money goes. Two questions and we’re in.</p>
      </div>

      <form className={styles.card} onSubmit={submit} noValidate>
        <div className={form.field} style={{ marginTop: 0 }}>
          <label className={form.label} htmlFor="ob-name">
            What should I call you?
          </label>
          <input
            id="ob-name"
            className={form.input}
            value={name}
            maxLength={40}
            placeholder="your name"
            autoComplete="given-name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <fieldset className={`${form.field} ${form.fieldset}`}>
          <legend className={form.label}>What did {monthName(month)} start with?</legend>
          <p className={form.hint}>Rough is fine — you can fix it later. Leave a place empty if you don’t use it.</p>
          <div className={styles.sources}>
            {SOURCES.map((s) => (
                <label key={s.key} className={styles.source}>
                  <span className={styles.sourceIcon} style={{ background: `var(--cat-${s.color})` }} aria-hidden="true">
                    <DynamicIcon name={s.icon} size={20} />
                  </span>
                  <span className={styles.sourceLabel}>{s.label}</span>
                  <span className={styles.rupee} aria-hidden="true">
                    ₹
                  </span>
                  <input
                    className={styles.sourceInput}
                    inputMode="decimal"
                    placeholder="0"
                    value={values[s.key]}
                    aria-label={`${s.label} balance at the start of ${monthName(month)}`}
                    onChange={(e) => setValues((v) => ({ ...v, [s.key]: sanitizeAmountInput(e.target.value) }))}
                  />
                </label>
              ))}
          </div>
          <p className={styles.total}>
            {monthName(month)} starts with <strong className="num">{formatINR(total)}</strong>
          </p>
        </fieldset>

        {error && (
          <div role="alert" className={styles.error}>
            <p className={form.error}>
              <CircleAlert size={16} /> {error.message}
            </p>
            {error.detail && <p className={styles.detail}>{error.detail}</p>}
          </div>
        )}

        <Button type="submit" size="lg" block disabled={busy} style={{ marginTop: 20 }}>
          {busy ? 'Planting the meadow…' : 'Let’s see where it goes'}
        </Button>
        {mode === 'local' && <p className={styles.local}>Saved on this device only.</p>}
      </form>
    </main>
  )
}
