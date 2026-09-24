import { m } from 'motion/react'
import { Settings } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useData } from '../../state/store'
import { LogoMark, Wordmark } from '../Brand'
import { AddButton } from './AddButton'
import { NAV_ITEMS } from './navItems'
import styles from './SideRail.module.css'

/** Desktop navigation: a left rail over the sky, clear of the hill. */
export function SideRail() {
  const [path] = useLocation()
  const demo = useData((s) => s.demo)
  const pending = useData((s) => s.pending)
  const mode = useData((s) => s.mode)
  const items = [...NAV_ITEMS, { path: '/settings', label: 'Settings', icon: Settings }]
  return (
    <aside className={styles.rail}>
      <Link href="/" className={styles.brand} aria-label="Where’dItGo home">
        <LogoMark size={40} />
        <Wordmark />
      </Link>
      <nav aria-label="Main" className={styles.nav}>
        {items.map((item) => {
          const active = item.path === '/' ? path === '/' : path.startsWith(item.path)
          const Icon = item.icon
          return (
            <Link key={item.path} href={item.path} className={styles.item} aria-current={active ? 'page' : undefined}>
              {active && (
                <m.span layoutId="rail-blob" className={styles.blob} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
              )}
              <Icon size={21} strokeWidth={2.4} className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className={styles.add}>
        <AddButton variant="pill" />
      </div>
      <div className={styles.status}>
        {demo && <span className={styles.badge}>Demo data</span>}
        <span className={styles.sync} data-pending={pending > 0 || undefined}>
          {mode === 'cloud' ? (pending > 0 ? 'Saving…' : 'Synced') : 'On this device'}
        </span>
      </div>
    </aside>
  )
}
