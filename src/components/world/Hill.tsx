import { memo, type ReactNode } from 'react'
import { useUi } from '../../state/ui'
import { Daisy, Sunflower, TinyBloom, Tuft } from './Flora'
import styles from './Hill.module.css'

/**
 * The front hill: neon grass that sits *in front of* the content, so
 * whatever you scroll past disappears behind the meadow. The nav lives
 * on it. Plants are positioned along the same curve the hill is drawn
 * with, so they always stand on the grass.
 */

/** Height of the hill's top edge, as % from the top of the hill box. */
function edgeAt(x: number): number {
  return 22 + 6 * Math.sin(2 * Math.PI * (x * 1.05 + 0.12)) + 3 * Math.sin(2 * Math.PI * (x * 2.6 + 0.4))
}

const EDGE_PATH = (() => {
  const pts: string[] = []
  for (let i = 0; i <= 80; i++) {
    const x = i / 80
    pts.push(`${(x * 1000).toFixed(1)} ${edgeAt(x).toFixed(2)}`)
  }
  return `M${pts.join(' L')}`
})()

const HILL_PATH = `${EDGE_PATH} L1000 100 L0 100 Z`

const TICKS = Array.from({ length: 46 }, (_, i) => {
  const x = (i * 0.0217 + ((i * 7919) % 13) / 900) % 1
  const top = edgeAt(x) + 10 + ((i * 31) % 50)
  return { x: x * 1000, y: top }
})

type Plant =
  | { kind: 'tuft'; x: number; w: number; tone: 0 | 1 }
  | { kind: 'daisy'; x: number; h: number; petal?: string }
  | { kind: 'sun'; x: number; h: number }
  | { kind: 'bloom'; x: number; color: string }

const MOBILE_PLANTS: Plant[] = [
  { kind: 'tuft', x: 0.02, w: 40, tone: 0 },
  { kind: 'daisy', x: 0.06, h: 50 },
  { kind: 'tuft', x: 0.13, w: 34, tone: 1 },
  { kind: 'bloom', x: 0.2, color: '#ff9b4f' },
  { kind: 'tuft', x: 0.27, w: 42, tone: 0 },
  { kind: 'sun', x: 0.33, h: 58 },
  { kind: 'tuft', x: 0.4, w: 30, tone: 1 },
  { kind: 'tuft', x: 0.61, w: 34, tone: 0 },
  { kind: 'daisy', x: 0.67, h: 42, petal: '#ff9ec7' },
  { kind: 'tuft', x: 0.73, w: 40, tone: 1 },
  { kind: 'bloom', x: 0.79, color: '#ffc6de' },
  { kind: 'tuft', x: 0.86, w: 36, tone: 0 },
  { kind: 'daisy', x: 0.96, h: 56 },
]

const DESKTOP_EXTRA: Plant[] = [
  { kind: 'sun', x: 0.47, h: 92 },
  { kind: 'daisy', x: 0.53, h: 60, petal: '#ff9ec7' },
  { kind: 'tuft', x: 0.5, w: 44, tone: 1 },
  { kind: 'sun', x: 0.9, h: 76 },
  { kind: 'bloom', x: 0.44, color: '#ffd23f' },
  { kind: 'daisy', x: 0.24, h: 64 },
]

function PlantAt({ plant, i }: { plant: Plant; i: number }) {
  const style = {
    left: `${plant.x * 100}%`,
    top: `${edgeAt(plant.x)}%`,
    animationDuration: `${3.4 + (i % 5) * 0.55}s`,
    animationDelay: `-${(i * 0.73) % 4}s`,
  }
  let body: ReactNode
  switch (plant.kind) {
    case 'tuft':
      body = <Tuft width={plant.w} tone={plant.tone} />
      break
    case 'daisy':
      body = <Daisy height={plant.h} petal={plant.petal} />
      break
    case 'sun':
      body = <Sunflower height={plant.h} />
      break
    case 'bloom':
      body = <TinyBloom color={plant.color} />
      break
  }
  return (
    <span className={`${styles.plant} ${plant.kind === 'tuft' ? styles.tuft : styles.flower}`} style={{ left: style.left, top: style.top }}>
      <span className={styles.gustable}>
        <span className={`${styles.sway} ambient`} style={{ animationDuration: style.animationDuration, animationDelay: style.animationDelay }}>
          {body}
        </span>
      </span>
    </span>
  )
}

export const Hill = memo(function Hill({ children, desktop }: { children?: ReactNode; desktop: boolean }) {
  const gust = useUi((s) => s.gust)
  const plants = desktop ? [...MOBILE_PLANTS, ...DESKTOP_EXTRA] : MOBILE_PLANTS
  return (
    <div className={styles.hill} data-gust={gust % 2}>
      <div className={styles.body}>
        <svg className={styles.ground} viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="hill-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#8bff5c" />
              <stop offset="0.45" stopColor="#5fe03a" />
              <stop offset="1" stopColor="#2fc63c" />
            </linearGradient>
          </defs>
          <path d={HILL_PATH} fill="url(#hill-fill)" />
          <path d={EDGE_PATH} fill="none" stroke="#1a0c30" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <g stroke="#27b93b" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke">
            {TICKS.map((t, i) => (
              <path key={i} d={`M${t.x} ${t.y} l-3 -6 M${t.x + 6} ${t.y} l2 -7`} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </svg>
        <div className={styles.plants} aria-hidden="true">
          {plants.map((p, i) => (
            <PlantAt key={i} plant={p} i={i} />
          ))}
        </div>
        {children}
      </div>
    </div>
  )
})
