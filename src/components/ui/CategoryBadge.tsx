import type { Category } from '../../data/types'
import { DynamicIcon } from './DynamicIcon'
import { catColor } from './palette'
import styles from './CategoryBadge.module.css'

/** A category's icon in its colour, on a little organic blob. */
export function CategoryBadge({
  category,
  icon,
  color,
  size = 40,
  className,
}: {
  category?: Pick<Category, 'icon' | 'color'>
  icon?: string
  color?: number
  size?: number
  className?: string
}) {
  const slot = color ?? category?.color ?? 0
  return (
    <span
      className={[styles.badge, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, background: catColor(slot) }}
      aria-hidden="true"
    >
      <DynamicIcon name={icon ?? category?.icon ?? 'shapes'} size={Math.round(size * 0.5)} strokeWidth={2.2} />
    </span>
  )
}
