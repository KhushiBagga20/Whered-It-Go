import { m } from 'motion/react'
import { Plus } from 'lucide-react'
import { ui } from '../../state/ui'
import styles from './AddButton.module.css'

/** The big tactile +. Everything starts here. */
export function AddButton({ variant = 'round' }: { variant?: 'round' | 'pill' }) {
  return (
    <m.button
      type="button"
      className={variant === 'round' ? styles.round : styles.pill}
      onClick={() => ui.openComposer()}
      aria-label="Add some evidence (new transaction)"
      whileHover={{ scale: 1.05, rotate: variant === 'round' ? -4 : 0 }}
      whileTap={{ scale: 0.88, rotate: variant === 'round' ? 90 : 0, y: 3 }}
      transition={{ type: 'spring', stiffness: 600, damping: 22 }}
    >
      <Plus size={variant === 'round' ? 34 : 22} strokeWidth={3.2} />
      {variant === 'pill' && <span>Add evidence</span>}
    </m.button>
  )
}
