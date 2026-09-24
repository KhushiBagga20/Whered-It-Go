import { CircleAlert, Mail } from 'lucide-react'
import { useState } from 'react'
import { LogoMark, Wordmark } from '../components/Brand'
import { Button } from '../components/ui/Button'
import form from '../components/ui/Form.module.css'
import { Segmented } from '../components/ui/Segmented'
import { sendMagicLink, signInWithPassword, signUp } from '../lib/auth'
import { Mascot } from '../mascot/Mascot'
import { bootCloud } from '../state/store'
import styles from './AuthPage.module.css'

type Mode = 'signin' | 'signup'

/** Get in quickly. Auth isn't the point of the app, so it stays small. */
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError({ message: 'That email doesn’t look right.' })
      return
    }
    if (password.length < 6) {
      setError({ message: 'Password needs at least 6 characters.' })
      return
    }
    setBusy(true)
    try {
      const result = mode === 'signin' ? await signInWithPassword(email.trim(), password) : await signUp(email.trim(), password)
      if (!result.ok) setError({ message: result.message ?? 'That didn’t work.', detail: result.detail })
      else if (result.confirm) setSent(`Check ${email.trim()} to confirm your account, then come back.`)
      else if (result.userId) await bootCloud(result.userId, result.email ?? email.trim())
    } catch (err) {
      setError({ message: 'Something broke.', detail: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }

  const magic = async () => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError({ message: 'Type your email first.' })
      return
    }
    setBusy(true)
    const result = await sendMagicLink(email.trim()).catch((err: unknown) => ({
      ok: false,
      message: 'Something broke.',
      detail: err instanceof Error ? err.message : String(err),
    }))
    setBusy(false)
    if (!result.ok) setError({ message: result.message ?? 'That didn’t work.', detail: result.detail })
    else setSent(`Magic link sent to ${email.trim()}. Open it on this phone.`)
  }

  return (
    <main className={styles.page}>
      <div className={styles.brand}>
        <LogoMark size={64} />
        <Wordmark size="lg" />
      </div>
      <div className={styles.mascot}>
        <Mascot pose="wave" expression="happy" size={110} />
        <p className={styles.hi}>sign in. i need to see where it went.</p>
      </div>

      <form className={styles.card} onSubmit={submit} noValidate>
        {sent ? (
          <div className={styles.sent} role="status">
            <Mail size={28} />
            <p>{sent}</p>
            <Button variant="ghost" onClick={() => setSent(null)}>
              Back
            </Button>
          </div>
        ) : (
          <>
            <Segmented<Mode>
              label="Sign in or create account"
              value={mode}
              onChange={(m) => {
                setMode(m)
                setError(null)
              }}
              options={[
                { value: 'signin', label: 'Sign in' },
                { value: 'signup', label: 'New here' },
              ]}
            />
            <div className={form.field}>
              <label className={form.label} htmlFor="auth-email">
                Email
              </label>
              <input
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
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
              {busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
            <button type="button" className={styles.magic} onClick={magic} disabled={busy}>
              or email me a magic link
            </button>
          </>
        )}
      </form>
    </main>
  )
}
