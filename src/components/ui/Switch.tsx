import { m } from 'motion/react'
import styles from './Switch.module.css'

/** A chunky on/off switch (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={styles.switch}
      onClick={() => onChange(!checked)}
    >
      <m.span
        className={styles.knob}
        initial={false}
        animate={{ x: checked ? 22 : 0, rotate: checked ? 0 : -20 }}
        transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      />
    </button>
  )
}
