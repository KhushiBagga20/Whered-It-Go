import { memo } from 'react'
import styles from './Sun.module.css'

/**
 * The sun tracks the month: high when the month is young, sinking toward
 * the hills as it runs out (past months have fully set). A quiet way of
 * saying "how much month is left".
 */
export const Sun = memo(function Sun({ progress, size = 112 }: { progress: number; size?: number }) {
  const p = Math.min(1, Math.max(0, progress))
  // gentle arc: drifts right and down
  const x = p * 26
  const y = p * p * 70 + p * 34
  const setting = p > 0.85
  return (
    <div
      className={styles.sun}
      style={{ width: size, height: size, transform: `translate(${x}px, ${y}px)` }}
      data-setting={setting || undefined}
      aria-hidden="true"
    >
      <div className={`${styles.rays} ambient`} />
      <div className={`${styles.halo} ambient`} />
      <svg viewBox="0 0 100 100" className={styles.disc}>
        <circle cx="50" cy="50" r="40" fill={setting ? '#ffb347' : '#ffd23f'} />
        <path d="M22 66 A36 36 0 0 0 78 66 A40 40 0 0 1 22 66Z" fill={setting ? '#ff8a3d' : '#ffc400'} />
        <path d="M30 32 Q36 25 45 23" stroke="#fff6c9" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M27 40 Q28 38 29 37" stroke="#fff6c9" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
})
