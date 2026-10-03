import { ChevronRight, Download, FileJson, KeyRound, LogOut, Plus, RotateCcw, Sparkles, Trash2, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { LogoMark, Wordmark } from '../components/Brand'
import { CategoryEditor } from '../components/CategoryEditor'
import { Button } from '../components/ui/Button'
import { CategoryBadge } from '../components/ui/CategoryBadge'
import form from '../components/ui/Form.module.css'
import { Segmented } from '../components/ui/Segmented'
import { Switch } from '../components/ui/Switch'
import type { Category, Judginess, MotionLevel, TxType } from '../data/types'
import { changePin } from '../lib/auth'
import { todayKey } from '../lib/dates'
import { downloadText, snapshotToJson, transactionsToCsv } from '../lib/export'
import { react } from '../mascot/react'
import { useCategories } from '../state/selectors'
import { resetLocal, signOut, updatePrefs, updateProfile, useData } from '../state/store'
import { ui } from '../state/ui'
import styles from './SettingsPage.module.css'

function Panel({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.panel} aria-label={title}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {note && <p className={styles.panelNote}>{note}</p>}
      {children}
    </section>
  )
}

function ToggleRow({
  title,
  line,
  checked,
  onChange,
  disabled,
}: {
  title: string
  line?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className={form.toggleRow}>
      <span className={form.toggleText}>
        <strong>{title}</strong>
        {line && <span>{line}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  )
}

export default function SettingsPage() {
  const profile = useData((s) => s.profile)
  const prefs = profile.prefs
  const mode = useData((s) => s.mode)
  const email = useData((s) => s.email)
  const demo = useData((s) => s.demo)
  const viewer = useData((s) => s.viewer)
  const owner = viewer?.role === 'owner'
  const expenseCats = useCategories('expense')
  const incomeCats = useCategories('income')
  const [name, setName] = useState(profile.displayName)
  const [mascotName, setMascotName] = useState(profile.mascotName)
  const [editor, setEditor] = useState<{ kind: TxType; category?: Category } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const saveNames = () => {
    const patch: Partial<typeof profile> = {}
    if (name.trim() !== profile.displayName) patch.displayName = name.trim()
    if (mascotName.trim() && mascotName.trim() !== profile.mascotName) patch.mascotName = mascotName.trim()
    if (Object.keys(patch).length) void updateProfile(patch)
  }

  const exportData = (kind: 'csv' | 'json') => {
    const s = useData.getState()
    const snap = {
      transactions: s.transactions,
      accounts: s.accounts,
      categories: s.categories,
      monthSettings: s.monthSettings,
      profile: s.profile,
      comments: s.comments,
      members: s.members,
    }
    const stamp = todayKey()
    if (kind === 'csv') downloadText(`whereditgo-${stamp}.csv`, transactionsToCsv(snap), 'text/csv')
    else downloadText(`whereditgo-${stamp}.json`, snapshotToJson(snap), 'application/json')
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className="eyebrow">Settings</p>
        <h1 className={styles.title}>The fine print</h1>
      </header>

      <Panel title={owner ? 'You, the money guy' : 'You, the co-pilot'}>
        <div className={styles.whoCard} data-person={viewer?.person ?? undefined}>
          <span className={styles.whoFlower} aria-hidden="true">
            {viewer?.person === 'khushi' ? '🌸' : '🌻'}
          </span>
          <span>
            <strong>{viewer?.name ?? (owner ? 'Jais' : 'Khushi')}</strong>
            <span className={styles.whoLine}>
              {owner
                ? 'Tracks the money. Adds, edits and deletes everything.'
                : 'Sees everything, fixes things, leaves notes. Can’t add or delete transactions.'}
            </span>
          </span>
        </div>
        <p className={styles.line}>
          {mode === 'cloud' ? (
            <>
              Signed in{email ? <> as <strong>{email}</strong></> : null}. Synced through Supabase and private to the two of you —
              the database itself enforces who can do what.
            </>
          ) : (
            <>
              {demo ? <strong>You’re looking at demo data</strong> : 'Your data lives on this device only'} — on-device mode, no
              real PINs. Add Supabase keys for the real thing (see DEPLOYMENT.md).
            </>
          )}
        </p>
        {mode === 'cloud' && <ChangePin />}
        <div className={styles.buttons}>
          <Button variant="secondary" icon={<LogOut size={18} />} onClick={() => void signOut()}>
            {mode === 'cloud' ? 'Log out' : 'Switch person'}
          </Button>
        </div>
      </Panel>

      {owner && (
        <Panel title="You two">
          <div className={form.field} style={{ marginTop: 0 }}>
            <label className={form.label} htmlFor="set-name">
              What should she call you?
            </label>
            <input
              id="set-name"
              className={form.input}
              value={name}
              maxLength={40}
              placeholder="your name"
              onChange={(e) => setName(e.target.value)}
              onBlur={saveNames}
            />
          </div>
          <div className={form.field}>
            <label className={form.label} htmlFor="set-mascot">
              Her name
            </label>
            <input
              id="set-mascot"
              className={form.input}
              value={mascotName}
              maxLength={24}
              onChange={(e) => setMascotName(e.target.value)}
              onBlur={saveNames}
            />
          </div>
        </Panel>
      )}

      {mode === 'local' && (
        <Panel title="This device">
          <div className={styles.buttons}>
            {demo ? (
              <Button
                variant={confirmReset ? 'danger' : 'primary'}
                icon={<Sparkles size={18} />}
                onClick={() => (confirmReset ? void resetLocal('fresh') : setConfirmReset(true))}
              >
                {confirmReset ? 'Yes, clear the demo' : 'Start for real'}
              </Button>
            ) : (
              <>
                <Button
                  variant={confirmReset ? 'danger' : 'secondary'}
                  icon={<Trash2 size={18} />}
                  onClick={() => (confirmReset ? void resetLocal('fresh') : setConfirmReset(true))}
                >
                  {confirmReset ? 'Tap again: erase everything' : 'Erase & start over'}
                </Button>
                <Button variant="ghost" icon={<RotateCcw size={18} />} onClick={() => void resetLocal('demo')}>
                  Load demo
                </Button>
              </>
            )}
          </div>
          {confirmReset && (
            <p className={styles.warn} role="alert">
              This wipes every transaction, account, category and note on this device. Export first if you want a copy.
            </p>
          )}
        </Panel>
      )}

      {owner && (
        <Panel title="Categories" note="Tap one to rename it, change its icon or colour. “Other” is yours to customise too.">
          <h3 className={styles.subhead}>Spending</h3>
          <ul className={styles.catList}>
            {expenseCats.map((c) => (
              <li key={c.id}>
                <button type="button" className={styles.catRow} onClick={() => setEditor({ kind: 'expense', category: c })}>
                  <CategoryBadge category={c} size={34} />
                  <span>{c.name}</span>
                  <ChevronRight size={18} className={styles.chev} />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" icon={<Plus size={16} strokeWidth={3} />} onClick={() => setEditor({ kind: 'expense' })}>
            New spending category
          </Button>
          <h3 className={styles.subhead}>Money comes from</h3>
          <ul className={styles.catList}>
            {incomeCats.map((c) => (
              <li key={c.id}>
                <button type="button" className={styles.catRow} onClick={() => setEditor({ kind: 'income', category: c })}>
                  <CategoryBadge category={c} size={34} />
                  <span>{c.name}</span>
                  <ChevronRight size={18} className={styles.chev} />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" icon={<Plus size={16} strokeWidth={3} />} onClick={() => setEditor({ kind: 'income' })}>
            New income source
          </Button>
        </Panel>
      )}

      {owner && (
        <Panel title="Accounts">
          <Link href="/money" className={styles.linkRow}>
            <Wallet size={20} /> Manage Bank, UPI, Cash & friends <ChevronRight size={18} className={styles.chev} />
          </Link>
        </Panel>
      )}

      <Panel title={`${profile.mascotName}`} note="The tiny judge. She lives in the meadow.">
        <ToggleRow
          title="Show her"
          line="Hide her if you need to focus."
          checked={prefs.mascotVisible}
          onChange={(v) => void updatePrefs({ mascotVisible: v })}
        />
        <ToggleRow
          title="Let her react"
          line="Comments on what happens. Never saved anywhere."
          checked={prefs.reactions}
          disabled={!prefs.mascotVisible}
          onChange={(v) => void updatePrefs({ reactions: v })}
        />
        <div className={form.field}>
          <span className={form.label}>How judgy</span>
          <Segmented<Judginess>
            label="How judgy"
            value={prefs.judginess}
            onChange={(v) => void updatePrefs({ judginess: v })}
            options={[
              { value: 'chill', label: 'Chill' },
              { value: 'normal', label: 'Normal', color: 'var(--petal-300)' },
              { value: 'strict', label: 'Strict', color: 'var(--petal-500)' },
            ]}
          />
          <p className={form.hint}>Chill doubles her “that’s a lot” thresholds; strict halves them.</p>
        </div>
        <div className={styles.buttons}>
          <Button variant="ghost" size="sm" onClick={() => react('poke')} disabled={!prefs.mascotVisible || !prefs.reactions}>
            Poke her
          </Button>
          <Link href="/mascot" className={styles.linkRow}>
            See all her faces <ChevronRight size={18} />
          </Link>
        </div>
      </Panel>

      <Panel title="Motion">
        <Segmented<MotionLevel>
          label="Motion"
          value={prefs.motion}
          onChange={(v) => void updatePrefs({ motion: v })}
          options={[
            { value: 'full', label: 'Full meadow' },
            { value: 'calm', label: 'Calm' },
            { value: 'minimal', label: 'Still' },
          ]}
        />
        <p className={form.hint} style={{ marginTop: 8 }}>
          Calm stops the swaying background; Still turns off animation almost everywhere. Your phone’s “reduce motion” setting
          is always respected.
        </p>
        <div className={form.field}>
          <span className={form.label}>Weeks start on</span>
          <Segmented<'1' | '0'>
            label="Weeks start on"
            value={String(prefs.weekStartsOn) as '1' | '0'}
            onChange={(v) => void updatePrefs({ weekStartsOn: Number(v) as 0 | 1 })}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Your data" note="Yours to keep. Exports include every transaction.">
        <div className={styles.buttons}>
          <Button variant="secondary" icon={<Download size={18} />} onClick={() => exportData('csv')}>
            Export CSV
          </Button>
          <Button variant="secondary" icon={<FileJson size={18} />} onClick={() => exportData('json')}>
            Export JSON
          </Button>
        </div>
      </Panel>

      <footer className={styles.about}>
        <LogoMark size={48} />
        <Wordmark />
        <p>Where your money goes to disappear beautifully.</p>
        <p className={styles.madeBy}>made with love (and loss) by {profile.mascotName.toLowerCase()}</p>
      </footer>

      <CategoryEditor
        open={Boolean(editor)}
        kind={editor?.kind ?? 'expense'}
        category={editor?.category}
        onClose={() => setEditor(null)}
      />
    </div>
  )
}

/** Change your PIN: the database checks the current one (and counts misses). */
function ChangePin() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}$/.test(current) || !/^\d{4}$/.test(next)) {
      setError('Both PINs are exactly 4 digits.')
      return
    }
    setBusy(true)
    const result = await changePin(current, next).catch((err: unknown) => ({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }))
    setBusy(false)
    if (result.ok) {
      ui.toast('PIN changed.', { tone: 'success' })
      setOpen(false)
      setCurrent('')
      setNext('')
    } else setError(result.message)
  }

  if (!open) {
    return (
      <div className={styles.buttons} style={{ marginBottom: 10 }}>
        <Button variant="secondary" size="sm" icon={<KeyRound size={16} />} onClick={() => setOpen(true)}>
          Change PIN
        </Button>
      </div>
    )
  }
  return (
    <form className={styles.pinForm} onSubmit={submit} noValidate>
      <div className={form.row}>
        <div>
          <label className={form.label} htmlFor="pin-current">
            Current PIN
          </label>
          <input
            id="pin-current"
            className={form.input}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(digits(e.target.value))}
          />
        </div>
        <div>
          <label className={form.label} htmlFor="pin-new">
            New PIN
          </label>
          <input
            id="pin-new"
            className={form.input}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(digits(e.target.value))}
          />
        </div>
      </div>
      {error && (
        <p className={form.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.buttons}>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save new PIN'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
