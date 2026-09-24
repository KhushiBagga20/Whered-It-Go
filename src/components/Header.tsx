import { Settings } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useIsDesktop } from '../hooks/useMedia'
import { useData } from '../state/store'
import { LogoMark, Wordmark } from './Brand'
import styles from './Header.module.css'
import { MonthNavigator } from './MonthNavigator'

/** Phone: brand row that scrolls away + a sticky month bar. Desktop: just the month bar. */
export function Header() {
  const desktop = useIsDesktop()
  const [path] = useLocation()
  const demo = useData((s) => s.demo)
  const pending = useData((s) => s.pending)
  const showMonth = !path.startsWith('/settings') && !path.startsWith('/mascot')
  return (
    <>
      {!desktop && (
        <header className={styles.top}>
          <Link href="/" className={styles.brand} aria-label="Where’dItGo home">
            <LogoMark size={34} />
            <Wordmark />
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
