import { m, useReducedMotion } from 'motion/react'
import { memo } from 'react'
import { createPortal } from 'react-dom'
import { Petal, Sparkle } from '../components/world/Flora'
import { useUi, type Burst } from '../state/ui'
import styles from './BurstLayer.module.css'

/**
 * Spending: petals and ₹ signs drift up and away — money leaving,
 * beautifully. Receiving: a pop of sunshine that falls back down.
 */
const COUNT = 14

const OneBurst = memo(function OneBurst({ burst }: { burst: Burst }) {
  const spent = burst.kind === 'spent'
  return (
    <div className={styles.origin} style={{ left: burst.x, top: burst.y }}>
      {Array.from({ length: COUNT }, (_, i) => {
        const angle = (i / COUNT) * Math.PI * 2 + (i % 3) * 0.3
        const dist = 60 + ((i * 37) % 70)
        const x = Math.cos(angle) * dist
        const y = spent ? -90 - ((i * 53) % 120) : Math.sin(angle) * dist - 30
        const fall = spent ? y - 40 : y + 90
        const glyph = spent ? i % 4 === 0 : i % 5 === 0
        return (
          <m.span
            key={i}
            className={styles.particle}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{
              x: [0, x * 0.7, x],
              y: [0, y, fall],
              opacity: [0, 1, 0],
              scale: [0.4, 1.1, 0.8],
              rotate: [0, (i % 2 ? 1 : -1) * 200],
            }}
            transition={{ duration: 1.25 + (i % 4) * 0.08, ease: 'easeOut', times: [0, 0.45, 1] }}
          >
            {glyph ? (
              <span className={spent ? styles.rupee : styles.rupeeIn}>₹</span>
            ) : spent ? (
              <Petal color={i % 3 ? '#ffc6de' : '#ff9ec7'} />
            ) : (
              <Sparkle size={12 + (i % 3) * 4} color={i % 2 ? '#ffd23f' : '#8bff5c'} />
            )}
          </m.span>
        )
      })}
    </div>
  )
})

export function BurstLayer() {
  const bursts = useUi((s) => s.bursts)
  const reduced = useReducedMotion()
  if (reduced || !bursts.length) return null
  return createPortal(
    <div className={styles.layer} aria-hidden="true">
      {bursts.map((b) => (
        <OneBurst key={b.id} burst={b} />
      ))}
    </div>,
    document.body,
  )
}
