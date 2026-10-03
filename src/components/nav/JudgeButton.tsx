import { m } from 'motion/react'
import { Eye } from 'lucide-react'
import { compareTransactionsDesc } from '../../lib/finance'
import { useData } from '../../state/store'
import { ui } from '../../state/ui'
import styles from './AddButton.module.css'

/**
 * Khushi's centre button. She can't add transactions, so instead of "+"
 * she gets the eye: straight to the newest evidence.
 */
export function JudgeButton({ variant = 'round' }: { variant?: 'round' | 'pill' }) {
  const open = () => {
    const latest = [...useData.getState().transactions].sort(compareTransactionsDesc)[0]
    if (latest) ui.showDetail(latest.id)
    else ui.toast('Nothing to judge yet. Suspicious.')
  }
  return (
    <m.button
      type="button"
      className={variant === 'round' ? `${styles.round} ${styles.judge}` : `${styles.pill} ${styles.judge}`}
      onClick={open}
      aria-label="Judge the latest transaction"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.88, y: 3 }}
      transition={{ type: 'spring', stiffness: 600, damping: 22 }}
    >
      <Eye size={variant === 'round' ? 32 : 22} strokeWidth={2.8} />
      {variant === 'pill' && <span>Judge the latest</span>}
    </m.button>
  )
}
