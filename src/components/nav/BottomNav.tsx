import { m } from 'motion/react'
import { Link, useLocation } from 'wouter'
import { useData } from '../../state/store'
import { AddButton } from './AddButton'
import { JudgeButton } from './JudgeButton'
import styles from './BottomNav.module.css'
import { NAV_ITEMS, type NavItem } from './navItems'

function Item({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link href={item.path} className={styles.item} aria-current={active ? 'page' : undefined}>
      <span className={styles.iconWrap}>
        {active && (
          <m.span
            layoutId="nav-blob"
            className={styles.blob}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          />
        )}
        <Icon size={23} strokeWidth={active ? 2.6 : 2.2} className={styles.icon} />
      </span>
      <span className={styles.label}>{item.label}</span>
    </Link>
  )
}

/** Navigation that lives on the hill, thumb-height, with the + in the middle. */
export function BottomNav() {
  const [path] = useLocation()
  const observer = useData((s) => s.viewer?.role === 'observer')
  const [a, b, c, d] = NAV_ITEMS
  return (
    <nav className={styles.nav} aria-label="Main">
      <Item item={a} active={path === a.path} />
      <Item item={b} active={path === b.path} />
      <div className={styles.add}>
        {observer ? <JudgeButton /> : <AddButton />}
      </div>
      <Item item={c} active={path === c.path} />
      <Item item={d} active={path === d.path} />
    </nav>
  )
}
