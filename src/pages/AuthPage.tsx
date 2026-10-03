import { AnimatePresence, m, useAnimationControls } from 'motion/react'
import { ArrowLeft, CircleAlert, Delete, Mail } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LogoMark, Wordmark } from '../components/Brand'
import { Button } from '../components/ui/Button'
import form from '../components/ui/Form.module.css'
import { Daisy, Sunflower } from '../components/world/Flora'
import type { Person } from '../data/types'
import { rememberPerson, rememberedPerson, signInWithEmail, signInWithPin } from '../lib/auth'
import { isCloudConfigured } from '../lib/supabase'
import { Mascot } from '../mascot/Mascot'
import type { MascotAnimation, MascotExpression } from '../mascot/types'
import { bootCloud, signInLocal } from '../state/store'
import styles from './AuthPage.module.css'

const PEOPLE: { id: Person; name: string }[] = [
  { id: 'jais', name: 'Jais' },
  { id: 'khushi', name: 'Khushi' },
]

interface Mood {
  line: string
  expression: MascotExpression
  animation: MascotAnimation
  key: number
}

/**
 * WHERE'DITGO — who are you? Pick Jais or Khushi, then a 4-digit PIN.
 * The PIN is verified server-side; this screen only collects it.
 */
export default function AuthPage() {
  const [person, setPerson] = useState<Person | null>(rememberedPerson)
  const [pin, setPinState] = useState('')
  // Read by the keypad so two quick keystrokes can't both see the same old value.
  const pinRef = useRef('')
  const setPin = useCallback((v: string) => {
    pinRef.current = v
    setPinState(v)
  }, [])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'error' } | null>(null)
  const [lockedFor, setLockedFor] = useState(0)
  const [emailMode, setEmailMode] = useState(false)
  const [mood, setMood] = useState<Mood>({ line: 'who are you?', expression: 'suspicious', animation: 'none', key: 0 })
  const dots = useAnimationControls()
  const demo = !isCloudConfigured

  const say = useCallback(
    (line: string, expression: MascotExpression, animation: MascotAnimation = 'nod') =>
      setMood((m) => ({ line, expression, animation, key: m.key + 1 })),
    [],
  )

  // Lockout countdown.
  useEffect(() => {
    if (lockedFor <= 0) return
    const t = window.setTimeout(() => setLockedFor((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [lockedFor])

  const choose = useCallback(
    (p: Person | null) => {
      setPerson(p)
      setPin('')
      setMessage(null)
      if (p === 'jais') say('oh. it’s you.', 'judging')
      else if (p === 'khushi') say('hi me.', 'happy', 'hop')
      else say('who are you?', 'suspicious')
    },
    [say, setPin],
  )

  const submit = useCallback(
    async (code: string) => {
      if (!person) return
      setBusy(true)
      setMessage(null)
      try {
        if (demo) {
          rememberPerson(person)
          await signInLocal(person)
          return
        }
        const result = await signInWithPin(person, code)
        if (result.ok) {
          rememberPerson(person)
          say('welcome back.', 'happy', 'hop')
          await bootCloud(result.userId, result.email)
          return
        }
        setPin('')
        void dots.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.4 } })
        if (result.reason === 'wrong_pin') {
          setMessage({
            text: result.attemptsLeft > 0 ? `Not it. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} before a timeout.` : 'Not it.',
            tone: 'error',
          })
          say(result.attemptsLeft <= 1 ? 'careful.' : 'nope.', 'suspicious', 'shake')
        } else if (result.reason === 'locked') {
          setLockedFor(result.retryAfter)
          setMessage({ text: 'Too many wrong PINs.', tone: 'error' })
          say('absolutely not. wait.', 'shocked', 'faint')
        } else if (result.reason === 'not_set_up') {
          setMessage({ text: 'No PIN set for this person yet — see DEPLOYMENT.md, or use email below.', tone: 'error' })
          say('hm. no PIN yet.', 'sleepy')
        } else {
          setMessage({ text: `Couldn’t check the PIN right now. ${result.detail ?? ''}`.trim(), tone: 'error' })
          say('something broke.', 'shocked', 'shake')
        }
      } catch (e) {
        setPin('')
        setMessage({ text: `Something broke. ${e instanceof Error ? e.message : ''}`.trim(), tone: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [person, demo, dots, say, setPin],
  )

  const press = useCallback(
    (key: string) => {
      if (busy || lockedFor > 0 || !person) return
      const current = pinRef.current
      if (key === 'back') {
        setPin(current.slice(0, -1))
        return
      }
      if (!/^[0-9]$/.test(key) || current.length >= 4) return
      const next = current + key
      setPin(next)
      if (next.length === 4) void submit(next)
    },
    [busy, lockedFor, person, setPin, submit],
  )

  // Desktop: type the PIN on a keyboard.
  useEffect(() => {
    if (!person || emailMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Escape') choose(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [person, emailMode, press, choose])

  const chosen = PEOPLE.find((p) => p.id === person)

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <LogoMark size={56} />
        <Wordmark size="lg" />
      </div>

      <div className={styles.mascot} aria-live="polite">
        <Mascot pose="wave" expression={mood.expression} size={96} animation={mood.animation} animKey={mood.key} />
        <AnimatePresence mode="wait">
          <m.p
            key={mood.key}
            className={styles.line}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {mood.line}
          </m.p>
        </AnimatePresence>
      </div>

      {emailMode ? (
        <EmailFallback onBack={() => setEmailMode(false)} />
      ) : !chosen ? (
        <section className={styles.who} aria-labelledby="who-title">
          <h1 id="who-title" className={styles.question}>
            Who are you?
          </h1>
          <div className={styles.choices}>
            {PEOPLE.map((p, i) => (
              <m.button
                key={p.id}
                type="button"
                className={styles.choice}
                data-person={p.id}
                onClick={() => choose(p.id)}
                initial={{ opacity: 0, y: 24, rotate: i ? 3 : -3 }}
                animate={{ opacity: 1, y: 0, rotate: i ? 1.5 : -1.5 }}
                whileHover={{ y: -4, rotate: 0 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24, delay: 0.1 + i * 0.08 }}
              >
                <span className={styles.flower} aria-hidden="true">
                  {p.id === 'jais' ? <Sunflower height={86} /> : <Daisy height={80} petal="#ff9ec7" />}
                </span>
                <span className={styles.name}>{p.name}</span>
                <span className={styles.roleHint}>{p.id === 'jais' ? 'tracks the money' : 'judges the evidence'}</span>
              </m.button>
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.pinBox} aria-labelledby="pin-title">
          <div className={styles.pinHead}>
            <button type="button" className={styles.notYou} onClick={() => choose(null)}>
              <ArrowLeft size={16} /> not {chosen.name}?
            </button>
            <h1 id="pin-title" className={styles.pinTitle}>
              <span aria-hidden="true">{chosen.id === 'jais' ? '🌻' : '🌸'}</span> {chosen.name}
            </h1>
          </div>

          <m.div
            className={styles.dots}
            animate={dots}
            role="status"
            aria-label={`${pin.length} of 4 digits entered`}
          >
            {[0, 1, 2, 3].map((i) => (
              <m.span
                key={i}
                className={styles.dot}
                data-filled={i < pin.length || undefined}
                animate={{ scale: i < pin.length ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              />
            ))}
          </m.div>

          <p className={styles.message} data-tone={message?.tone} role={message?.tone === 'error' ? 'alert' : undefined}>
            {lockedFor > 0
              ? `Locked. Try again in ${Math.floor(lockedFor / 60)}:${String(lockedFor % 60).padStart(2, '0')}.`
              : busy
                ? 'Checking…'
                : (message?.text ?? (demo ? 'On-device demo: any 4 digits get you in.' : '4-digit passcode'))}
          </p>

          <div className={styles.pad} aria-label="Number pad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((k) =>
              k === '' ? (
                <span key="gap" />
              ) : (
                <m.button
                  key={k}
                  type="button"
                  className={styles.key}
                  data-kind={k === 'back' ? 'back' : undefined}
                  onClick={() => press(k)}
                  disabled={busy || lockedFor > 0}
                  aria-label={k === 'back' ? 'Delete last digit' : k}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 20 }}
                >
                  {k === 'back' ? <Delete size={22} /> : k}
                </m.button>
              ),
            )}
          </div>
        </section>
      )}

      {!demo && !emailMode && (
        <button type="button" className={styles.emailLink} onClick={() => setEmailMode(true)}>
          <Mail size={15} /> Trouble? Sign in with email
        </button>
      )}
    </main>
  )
}

function EmailFallback({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  useEffect(() => emailRef.current?.focus(), [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || !password) {
      setError({ message: 'Enter the account’s email and password.' })
      return
    }
    setBusy(true)
    const result = await signInWithEmail(email.trim(), password).catch((err: unknown) => ({
      ok: false,
      message: 'Something broke.',
      detail: err instanceof Error ? err.message : String(err),
      userId: undefined,
      email: undefined,
    }))
    if (result.ok && result.userId) {
      await bootCloud(result.userId, result.email ?? email.trim())
      return
    }
    setBusy(false)
    setError({ message: result.message ?? 'That didn’t work.', detail: result.detail })
  }

  return (
    <form className={styles.card} onSubmit={submit} noValidate>
      <p className={styles.cardNote}>For setting things up, or if a PIN is locked. Accounts are created in Supabase — there’s no sign-up here.</p>
      <div className={form.field}>
        <label className={form.label} htmlFor="auth-email">
          Email
        </label>
        <input
          ref={emailRef}
          id="auth-email"
          className={form.input}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className={form.field}>
        <label className={form.label} htmlFor="auth-password">
          Password
        </label>
        <input
          id="auth-password"
          className={form.input}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <p className={form.error}>
            <CircleAlert size={16} /> {error.message}
          </p>
          {error.detail && <p className={styles.detail}>{error.detail}</p>}
        </div>
      )}
      <Button type="submit" size="lg" block disabled={busy} style={{ marginTop: 20 }}>
        {busy ? 'One sec…' : 'Sign in'}
      </Button>
      <button type="button" className={styles.emailLink} onClick={onBack}>
        <ArrowLeft size={15} /> Back to PIN
      </button>
    </form>
  )
}
