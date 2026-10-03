import { Settings } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useLayout } from '../hooks/useMedia'
import { useData } from '../state/store'
import { LogoMark, Wordmark } from './Brand'
import styles from './Header.module.css'
import { MonthNavigator } from './MonthNavigator'

/** Phones: brand row that scrolls away + a sticky month bar. With a side rail: just the month bar. */
export function Header() {
  const { rail, mode } = useLayout()
  const [path] = useLocation()
  const demo = useData((s) => s.demo)
  const pending = useData((s) => s.pending)
  const showMonth = !path.startsWith('/settings') && !path.startsWith('/mascot')
  return (
    <>
      {!rail && (
        <header className={styles.top}>
          <Link href="/" className={styles.brand} aria-label="Where’dItGo home">
            <LogoMark size={34} />
            <Wordmark tagline={mode !== 'cover'} />
          </Link>
          <div className={styles.right}>
            {demo && (
              <Link href="/settings" className={styles.demo} aria-label="Demo data — open settings to start for real">
                Demo
              </Link>
            )}
            {pending > 0 && <span className={styles.saving} aria-label="Saving" />}
            <Link href="/settings" className={styles.settings} aria-label="Settings">
              <Settings size={22} strokeWidth={2.3} />
            </Link>
          </div>
        </header>
      )}
      {showMonth && (
        <div className={styles.monthBar}>
          <div className={styles.monthInner}>
            <MonthNavigator />
          </div>
        </div>
      )}
    </>
  )
}
