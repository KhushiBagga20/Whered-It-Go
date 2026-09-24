import { m } from 'motion/react'
import { useId, type ReactNode } from 'react'
import styles from './Segmented.module.css'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Background of the moving blob when this option is active. */
  color?: string
}

/** Radio-group segmented control with a blob that slides between options. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (v: T) => void
  label: string
  size?: 'md' | 'lg'
}) {
  const id = useId()
  const activeColor = options.find((o) => o.value === value)?.color ?? 'var(--sun-300)'
  const onKey = (e: React.KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(options[(i + 1) % options.length].value)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(options[(i - 1 + options.length) % options.length].value)
    }
  }
  return (
    <div role="radiogroup" aria-label={label} className={`${styles.group} ${styles[size]}`} onKeyDown={onKey}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={styles.option}
            onClick={() => onChange(o.value)}
          >
            {active && (
              <m.span
                layoutId={`seg-${id}`}
                className={styles.blob}
                style={{ background: activeColor }}
                transition={{ type: 'spring', stiffness: 520, damping: 34 }}
              />
            )}
            <span className={styles.text}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
