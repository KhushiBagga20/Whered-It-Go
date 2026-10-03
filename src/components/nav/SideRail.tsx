import { m } from 'motion/react'
import { Settings } from 'lucide-react'
import { Link, useLocation } from 'wouter'
import { useData } from '../../state/store'
import { LogoMark, Wordmark } from '../Brand'
import { AddButton } from './AddButton'
import { JudgeButton } from './JudgeButton'
import { NAV_ITEMS } from './navItems'
import styles from './SideRail.module.css'

/**
 * Navigation when there's width to spare. Compact (unfolded Fold): a slim
 * column of icons with labels and the big round button on top. Desktop: the
 * full rail with words.
 */
export function SideRail({ compact }: { compact: boolean }) {
  const [path] = useLocation()
  const demo = useData((s) => s.demo)
  const pending = useData((s) => s.pending)
  const mode = useData((s) => s.mode)
  const viewer = useData((s) => s.viewer)
  const observer = viewer?.role === 'observer'
  const items = [...NAV_ITEMS, { path: '/settings', label: 'Settings', icon: Settings }]
  return (
    <aside className={styles.rail} data-compact={compact || undefined}>
      <Link href="/" className={styles.brand} aria-label="Where’dItGo home">
        <LogoMark size={compact ? 44 : 40} />
        {!compact && <Wordmark />}
      </Link>
      {compact && <div className={styles.addRound}>{observer ? <JudgeButton /> : <AddButton />}</div>}
      <nav aria-label="Main" className={styles.nav}>
        {items.map((item) => {
          const active = item.path === '/' ? path === '/' : path.startsWith(item.path)
          const Icon = item.icon
          return (
            <Link key={item.path} href={item.path} className={styles.item} aria-current={active ? 'page' : undefined}>
              {active && (
                <m.span layoutId="rail-blob" className={styles.blob} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />
              )}
              <Icon size={compact ? 22 : 21} strokeWidth={2.4} className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      {!compact && <div className={styles.add}>{observer ? <JudgeButton variant="pill" /> : <AddButton variant="pill" />}</div>}
      <div className={styles.status}>
        {viewer && (
          <span className={styles.who} data-person={viewer.person ?? undefined}>
            {viewer.person === 'khushi' ? '🌸' : '🌻'} {compact ? '' : viewer.name}
          </span>
        )}
        {demo && <span className={styles.badge}>{compact ? 'Demo' : 'Demo data'}</span>}
        {!compact && (
          <span className={styles.sync} data-pending={pending > 0 || undefined}>
            {mode === 'cloud' ? (pending > 0 ? 'Saving…' : 'Synced') : 'On this device'}
          </span>
        )}
      </div>
    </aside>
  )
}
