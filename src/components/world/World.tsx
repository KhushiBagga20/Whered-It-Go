import { memo } from 'react'
import { useUi } from '../../state/ui'
import { Petal, Sparkle } from './Flora'
import styles from './World.module.css'

/**
 * The fixed backdrop: purple sky, horizon glow, distant hills, drifting
 * clouds and a few petals. Everything that moves is its own element
 * animating only transform/opacity, so the compositor does the work.
 */

const SPARKLES = [
  { x: 8, y: 7, s: 8, d: 4.2, delay: 0 },
  { x: 26, y: 15, s: 6, d: 5.1, delay: 1.4 },
  { x: 47, y: 5, s: 9, d: 3.7, delay: 2.2 },
  { x: 63, y: 19, s: 6, d: 4.8, delay: 0.6 },
  { x: 81, y: 9, s: 7, d: 5.6, delay: 3.1 },
  { x: 93, y: 24, s: 5, d: 4.4, delay: 1.9 },
  { x: 36, y: 31, s: 5, d: 6.2, delay: 2.8 },
]

const PETALS = [
  { x: 6, d: 19, delay: 0, c: '#ffc6de' },
  { x: 22, d: 24, delay: 7, c: '#ffd23f' },
  { x: 41, d: 21, delay: 3, c: '#ffc6de' },
  { x: 58, d: 26, delay: 12, c: '#ff9b4f' },
  { x: 72, d: 18, delay: 5, c: '#ffc6de' },
  { x: 88, d: 23, delay: 15, c: '#ffe27f' },
]

const GUST = Array.from({ length: 12 }, (_, i) => ({
  y: 12 + ((i * 37) % 70),
  delay: (i % 6) * 0.07,
  c: ['#ffc6de', '#ffd23f', '#ff9ec7', '#ffe27f'][i % 4],
  r: (i * 53) % 360,
}))

export const World = memo(function World() {
  const gust = useUi((s) => s.gust)
  return (
    <div className={styles.world} aria-hidden="true">
      <div className={styles.sky} />
      <div className={`${styles.glow} ambient`} />
      {SPARKLES.map((p, i) => (
        <span
          key={i}
          className={`${styles.sparkle} ambient`}
          style={{ left: `${p.x}%`, top: `${p.y}%`, animationDuration: `${p.d}s`, animationDelay: `-${p.delay}s` }}
        >
          <Sparkle size={p.s} />
        </span>
      ))}
      <div className={`${styles.cloud} ${styles.cloudA} ambient`}>
        <Cloud />
      </div>
      <div className={`${styles.cloud} ${styles.cloudB} ambient`}>
        <Cloud />
      </div>
      <svg className={styles.hills} viewBox="0 0 400 200" preserveAspectRatio="none">
        <path d="M0 74 C52 50 104 52 152 68 C204 86 246 42 304 44 C350 46 380 60 400 66 V200 H0Z" fill="#3a1670" />
        <path d="M0 120 C66 94 132 100 194 118 C256 136 322 98 400 108 V200 H0Z" fill="#153f35" />
        <path d="M0 150 C80 134 150 140 220 152 C290 164 350 140 400 146 V200 H0Z" fill="#0f5031" />
      </svg>
      {PETALS.map((p, i) => (
        <span
          key={i}
          className={`${styles.petal} ambient`}
          style={{ left: `${p.x}%`, animationDuration: `${p.d}s`, animationDelay: `-${p.delay}s` }}
        >
          <Petal color={p.c} />
        </span>
      ))}
      {gust > 0 && (
        <div key={gust} className={styles.gust}>
          {GUST.map((g, i) => (
            <span
              key={i}
              className={styles.gustPetal}
              style={{ top: `${g.y}%`, animationDelay: `${g.delay}s`, rotate: `${g.r}deg` }}
            >
              <Petal color={g.c} />
            </span>
          ))}
        </div>
      )}
    </div>
  )
})

function Cloud() {
  return (
    <svg width="180" height="64" viewBox="0 0 180 64">
      <path
        d="M18 52 C4 52 2 34 18 32 C18 16 40 10 52 22 C60 4 92 2 102 22 C112 12 134 14 136 30 C156 26 172 40 160 52 Z"
        fill="#c07ae6"
      />
    </svg>
  )
}
