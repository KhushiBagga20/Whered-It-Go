import type { ReactNode } from 'react'
import { MascotSpot } from '../mascot/MascotSpot'
import type { MascotExpression, MascotPose } from '../mascot/types'
import styles from './EmptyState.module.css'

/**
 * Empty isn't blank: she comes over to comment on it. This is a real mascot
 * spot, so she moves here rather than appearing twice.
 */
export function EmptyState({
  title,
  line,
  expression = 'suspicious',
  pose = 'stand',
  action,
  tone = 'sky',
  size = 84,
}: {
  title: string
  line?: string
  expression?: MascotExpression
  pose?: MascotPose
  action?: ReactNode
  tone?: 'sky' | 'paper'
  size?: number
}) {
  return (
    <div className={styles.empty} data-tone={tone}>
      <div className={styles.mascot}>
        <MascotSpot pose={pose} expression={expression} size={size} bubble="right" desktop />
      </div>
      <p className={styles.title}>{title}</p>
      {line && <p className={styles.line}>{line}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
