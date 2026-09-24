import { BellRing, ChevronRight, Download, FileJson, LogOut, Plus, RotateCcw, Sparkles, Trash2, Wallet } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { LogoMark, Wordmark } from '../components/Brand'
import { CategoryEditor } from '../components/CategoryEditor'
import { Button } from '../components/ui/Button'
import { CategoryBadge } from '../components/ui/CategoryBadge'
import form from '../components/ui/Form.module.css'
import { Segmented } from '../components/ui/Segmented'
import { Switch } from '../components/ui/Switch'
import type { Category, Judginess, MotionLevel, NotificationPrefs, TxType } from '../data/types'
import { downloadText, snapshotToJson, transactionsToCsv } from '../lib/export'
import { todayKey } from '../lib/dates'
import { deliver, permissionState, requestPermission, testNudge, type PermissionState } from '../lib/notifications'
import { isCloudConfigured } from '../lib/supabase'
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

function ToggleRow({ title, line, checked, onChange, disabled }: { title: string; line?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
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
  const expenseCats = useCategories('expense')
  const incomeCats = useCategories('income')
  const [name, setName] = useState(profile.displayName)
  const [mascotName, setMascotName] = useState(profile.mascotName)
  const [editor, setEditor] = useState<{ kind: TxType; category?: Category } | null>(null)
  const [permission, setPermission] = useState<PermissionState>(permissionState())
  const [confirmReset, setConfirmReset] = useState(false)

  const saveNames = () => {
    const patch: Partial<typeof profile> = {}
    if (name.trim() !== profile.displayName) patch.displayName = name.trim()
    if (mascotName.trim() && mascotName.trim() !== profile.mascotName) patch.mascotName = mascotName.trim()
    if (Object.keys(patch).length) void updateProfile(patch)
  }

  const setNotif = (patch: Partial<NotificationPrefs>) => void updatePrefs({ notifications: { ...prefs.notifications, ...patch } })

  const enableNotifications = async (on: boolean) => {
    if (!on) {
      setNotif({ enabled: false })
      return
    }
    const result = await requestPermission()
    setPermission(result)
    if (result === 'granted') setNotif({ enabled: true })
    else if (result === 'denied') ui.toast('Notifications are blocked for this site. Allow them in your browser’s site settings.', { tone: 'error' })
    else if (result === 'unsupported') ui.toast('This browser can’t show notifications.', { tone: 'error' })
  }

  const exportData = (kind: 'csv' | 'json') => {
    const s = useData.getState()
    const snap = { transactions: s.transactions, accounts: s.accounts, categories: s.categories, monthSettings: s.monthSettings, profile: s.profile }
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

      <Panel title="Where the data lives">
        {mode === 'cloud' ? (
          <>
            <p className={styles.line}>
              Signed in as <strong>{email}</strong>. Your data is private to this account (Supabase, row-level security).
            </p>
            <Button variant="secondary" icon={<LogOut size={18} />} onClick={() => void signOut()}>
              Sign out
            </Button>
          </>
        ) : (
          <>
            <p className={styles.line}>
              {demo ? (
                <>
                  <strong>You’re looking at demo data</strong> (August–September 2026). Nothing here is real.
                </>
              ) : (
                <>Your data lives on this device only.</>
              )}{' '}
              {!isCloudConfigured && 'Add Supabase keys to sync across devices (see README).'}
            </p>
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
                This wipes every transaction, account and category on this device. Export first if you want a copy.
              </p>
            )}
          </>
        )}
      </Panel>

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

      <Panel title="Accounts">
        <Link href="/money" className={styles.linkRow}>
          <Wallet size={20} /> Manage Bank, UPI, Cash & friends <ChevronRight size={18} className={styles.chev} />
        </Link>
      </Panel>

      <Panel title={`${profile.mascotName}`} note="The tiny judge. She lives in the meadow.">
        <ToggleRow title="Show her" line="Hide her if you need to focus." checked={prefs.mascotVisible} onChange={(v) => void updatePrefs({ mascotVisible: v })} />
        <ToggleRow
          title="Let her react"
          line="Comments on what you add."
          checked={prefs.reactions}
          disabled={!prefs.mascotVisible}
          onChange={(v) => void updatePrefs({ reactions: v })}
        />
        <div className={form.field}>
          <span className={form.label} id="judginess">
            How judgy
          </span>
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
          <p className={form.hint}>
            Chill doubles her “that’s a lot” thresholds; strict halves them.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => react('poke')} disabled={!prefs.mascotVisible || !prefs.reactions}>
          Poke her
        </Button>
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
          Calm stops the swaying background; Still turns off animation almost everywhere. Your phone’s “reduce motion” setting is always respected.
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

      <Panel
        title="Nudges"
        note="Nudges show up while Where’dItGo is open or running in the background. Reminders when the app is fully closed need a push server — not set up yet (see README)."
      >
        <ToggleRow
          title="Allow nudges"
          line={
            permission === 'denied'
              ? 'Blocked in browser settings.'
              : permission === 'unsupported'
                ? 'Not supported in this browser.'
                : 'Never spam. Max one of each a day.'
          }
          checked={prefs.notifications.enabled && permission === 'granted'}
          disabled={permission === 'unsupported'}
          onChange={(v) => void enableNotifications(v)}
        />
        <div className={styles.indent} data-disabled={!(prefs.notifications.enabled && permission === 'granted') || undefined}>
          <ToggleRow
            title="Evening check-in"
            line="“yo where ur money go?” if nothing’s logged."
            checked={prefs.notifications.eveningNudge}
            onChange={(v) => setNotif({ eveningNudge: v })}
          />
          <div className={form.row} style={{ alignItems: 'center' }}>
            <label className={form.label} htmlFor="nudge-time">
              After
            </label>
            <input
              id="nudge-time"
              type="time"
              className={form.input}
              value={prefs.notifications.nudgeTime}
              onChange={(e) => e.target.value && setNotif({ nudgeTime: e.target.value })}
            />
          </div>
          <ToggleRow
            title="Big-day alert"
            line={`When a day passes ₹${prefs.notifications.bigDayThreshold.toLocaleString('en-IN')}.`}
            checked={prefs.notifications.bigDayAlert}
            onChange={(v) => setNotif({ bigDayAlert: v })}
          />
          <ToggleRow
            title="Celebrate no-spend days"
            line="“look at you saving money 🫡”"
            checked={prefs.notifications.celebrateSaving}
            onChange={(v) => setNotif({ celebrateSaving: v })}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<BellRing size={16} />}
            disabled={permission !== 'granted'}
            onClick={async () => {
              const ok = await deliver(testNudge(), { record: false })
              if (!ok) ui.toast('Couldn’t show a notification here.', { tone: 'error' })
            }}
          >
            Send a test nudge
          </Button>
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
