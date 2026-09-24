import { m } from 'motion/react'
import { accountKindMeta } from '../data/defaults'
import type { AccountPosition } from '../lib/finance'
import { formatINR } from '../lib/money'
import { DynamicIcon } from './ui/DynamicIcon'
import { MoneyDisplay } from './ui/MoneyDisplay'
import styles from './AccountCard.module.css'

/** A place money sits, drawn like a little sticker, with its share of the total. */
export function AccountCard({ position, onClick, index }: { position: AccountPosition; onClick: () => void; index: number }) {
  const { account, balance, monthIn, monthOut, share } = position
    const negative = balance < 0
  return (
    <m.button
      type="button"
      className={styles.card}
      onClick={onClick}
      style={{ ['--acc' as string]: `var(--cat-${account.color})` }}
      initial={{ opacity: 0, y: 20, rotate: index % 2 ? 4 : -4 }}
      animate={{ opacity: 1, y: 0, rotate: index % 2 ? 0.8 : -0.8 }}
      whileHover={{ rotate: 0, y: -3 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, delay: index * 0.05 }}
      aria-label={`${account.name}: ${formatINR(balance)}${account.archived ? ' (archived)' : ''}`}
      data-archived={account.archived || undefined}
    >
      <span className={styles.icon} aria-hidden="true">
        <DynamicIcon name={accountKindMeta(account.kind).icon} size={24} strokeWidth={2.3} />
      </span>
      <span className={styles.name}>
        {account.name}
        {account.archived && <span className={styles.archived}>archived</span>}
      </span>
      <MoneyDisplay value={balance} className={`${styles.balance} num`} />
      {negative && <span className={styles.warn}>below zero — something’s missing?</span>}
      <span className={styles.share} aria-hidden="true">
        <m.span
          className={styles.shareFill}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 + index * 0.05 }}
        />
      </span>
      <span className={styles.flow}>
        <span className={styles.in}>{formatINR(monthIn, { sign: 'always' })} in</span>
        <span className={styles.out}>{formatINR(-monthOut)} out</span>
      </span>
    </m.button>
  )
}
