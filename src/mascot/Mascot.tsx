import { m, useReducedMotion, type TargetAndTransition } from 'motion/react'
import { memo, useEffect, useId, useState } from 'react'
import { assetFor } from './assets'
import styles from './Mascot.module.css'
import type { MascotAnimation, MascotExpression, MascotPose } from './types'

/**
 * Tiny Khushi. A hand-drawn placeholder character, drawn in SVG so every
 * pose × expression combo works out of the box. Drop real sprites into
 * mascot/assets.ts and they replace the drawing automatically.
 */

const INK = '#1a0c30'
const SKIN = '#d69b74'
const HAIR = '#2b1530'
const TOP = '#ff7a1a'
const PANTS = '#4a1f8f'
const SHOE = '#fff6ea'
const BLUSH = '#ff8fb8'
const PETAL = '#ffc6de'
const SUN = '#ffd23f'

export interface MascotProps {
  pose?: MascotPose
  expression?: MascotExpression
  /** Rendered height in px. */
  size?: number
  animation?: MascotAnimation
  /** Changing this replays `animation`. */
  animKey?: number | string
  /** −1 (left) … 1 (right): where she's looking. */
  look?: number
  className?: string
  title?: string
}

const ANIMS: Record<MascotAnimation, TargetAndTransition> = {
  none: {},
  hop: { y: [0, -16, 0, -5, 0], transition: { duration: 0.7, ease: 'easeOut' } },
  shake: { rotate: [0, -9, 9, -7, 6, -3, 0], transition: { duration: 0.7 } },
  faint: { rotate: [0, -10, 24, 14, 0], y: [0, -4, 6, 2, 0], transition: { duration: 1.2, ease: 'easeInOut' } },
  spin: { rotate: [0, 360], y: [0, -12, 0], transition: { duration: 0.8, ease: 'easeInOut' } },
  nod: { rotate: [0, 7, -3, 4, 0], transition: { duration: 0.8 } },
  wiggle: { x: [0, -4, 4, -3, 3, 0], transition: { duration: 0.55 } },
}

const BLINKS: MascotExpression[] = ['neutral', 'shocked', 'judging', 'suspicious']

/** Discrete blinks (a re-render every few seconds) instead of a CSS loop that repaints every frame. */
function useBlink(enabled: boolean) {
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let t: number
    const schedule = () => {
      t = window.setTimeout(() => {
        setClosed(true)
        t = window.setTimeout(() => {
          setClosed(false)
          schedule()
        }, 130)
      }, 2600 + Math.random() * 3800)
    }
    schedule()
    return () => window.clearTimeout(t)
  }, [enabled])
  return closed
}

function Eyes({ expression, look, blink }: { expression: MascotExpression; look: number; blink: boolean }) {
  if (blink && BLINKS.includes(expression)) {
    return (
      <g stroke={INK} strokeWidth={2.2} strokeLinecap="round">
        <path d="M47.5 49 L54.5 49 M65.5 49 L72.5 49" />
      </g>
    )
  }
  const dx = look * 1.4
  const L = 51 + dx
  const R = 69 + dx
  switch (expression) {
    case 'happy':
    case 'proud':
      return (
        <g stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none">
          <path d="M47.5 50 Q51 45 54.5 50" />
          <path d="M65.5 50 Q69 45 72.5 50" />
        </g>
      )
    case 'sleepy':
      return (
        <g stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none">
          <path d="M47.5 48.5 Q51 51.5 54.5 48.5" />
          <path d="M65.5 48.5 Q69 51.5 72.5 48.5" />
        </g>
      )
    case 'shocked':
      return (
        <g>
          <circle cx={51} cy={48.5} r={4.4} fill="#fff" stroke={INK} strokeWidth={2} />
          <circle cx={69} cy={48.5} r={4.4} fill="#fff" stroke={INK} strokeWidth={2} />
          <circle cx={L} cy={48.8} r={2} fill={INK} />
          <circle cx={R} cy={48.8} r={2} fill={INK} />
        </g>
      )
    case 'judging':
      return (
        <g>
          <path d={`M${L - 3.3} 48.6 A3.3 3.3 0 0 0 ${L + 3.3} 48.6 Z`} fill={INK} />
          <path d={`M${R - 3.3} 48.6 A3.3 3.3 0 0 0 ${R + 3.3} 48.6 Z`} fill={INK} />
          <path d="M46.8 48.4 L55.2 48.4 M64.8 48.4 L73.2 48.4" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      )
    case 'suspicious':
      return (
        <g>
          <path d="M47 49 L55 49 M65 49 L73 49" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={53 + dx * 0.5} cy={49.6} r={1.7} fill={INK} />
          <circle cx={71 + dx * 0.5} cy={49.6} r={1.7} fill={INK} />
        </g>
      )
    case 'love':
      return (
        <g fill="#ff4f93" stroke={INK} strokeWidth={1.1}>
          <path d="M51 53 C46.4 49.8 46.6 45.8 49.3 45.6 C50.5 45.5 51 46.4 51 46.9 C51 46.4 51.5 45.5 52.7 45.6 C55.4 45.8 55.6 49.8 51 53 Z" />
          <path d="M69 53 C64.4 49.8 64.6 45.8 67.3 45.6 C68.5 45.5 69 46.4 69 46.9 C69 46.4 69.5 45.5 70.7 45.6 C73.4 45.8 73.6 49.8 69 53 Z" />
        </g>
      )
    default:
      return (
        <g>
          <ellipse cx={L} cy={49} rx={2.7} ry={3.4} fill={INK} />
          <ellipse cx={R} cy={49} rx={2.7} ry={3.4} fill={INK} />
          <circle cx={L + 0.9} cy={47.6} r={0.95} fill="#fff" />
          <circle cx={R + 0.9} cy={47.6} r={0.95} fill="#fff" />
        </g>
      )
  }
}

function Brows({ expression }: { expression: MascotExpression }) {
  const common = { stroke: INK, strokeWidth: 1.9, strokeLinecap: 'round' as const, fill: 'none' }
  switch (expression) {
    case 'judging':
      return (
        <g {...common}>
          <path d="M46.5 42.2 Q50.5 38.4 55 41.4" />
          <path d="M65 43.6 L73.6 42.8" />
        </g>
      )
    case 'suspicious':
      return (
        <g {...common}>
          <path d="M47 42.6 L55 44.2" />
          <path d="M65 44.2 L73 42.6" />
        </g>
      )
    case 'shocked':
      return (
        <g {...common}>
          <path d="M46.5 40.8 Q51 37.6 55.5 40" />
          <path d="M64.5 40 Q69 37.6 73.5 40.8" />
        </g>
      )
    case 'sleepy':
      return null
    default:
      return (
        <g {...common}>
          <path d="M47 42.4 Q51 40.6 55 42.2" />
          <path d="M65 42.2 Q69 40.6 73 42.4" />
        </g>
      )
  }
}

function Mouth({ expression }: { expression: MascotExpression }) {
  switch (expression) {
    case 'happy':
    case 'love':
      return (
        <g>
          <path d="M54.5 58.6 Q60 66.8 65.5 58.6 Z" fill={INK} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M57.3 62.6 Q60 64.9 62.7 62.6 Q60 61.6 57.3 62.6 Z" fill="#ff7fa8" />
        </g>
      )
    case 'proud':
      return <path d="M55 60.2 Q60.5 63.6 65.6 58.4" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
    case 'shocked':
      return <ellipse cx={60} cy={62} rx={3.1} ry={4} fill={INK} />
    case 'sleepy':
      return <ellipse cx={60} cy={61.2} rx={1.8} ry={2.2} fill={INK} />
    case 'judging':
      return <path d="M55.4 61.2 L64.6 60.2" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    case 'suspicious':
      return (
        <path
          d="M55.5 61.4 Q57.8 59.8 60 61.4 Q62.2 63 64.5 61.4"
          stroke={INK}
          strokeWidth={1.9}
          strokeLinecap="round"
          fill="none"
        />
      )
    default:
      return <path d="M56 60.4 Q60 63.2 64 60.4" stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
  }
}

function Limb({ d, color, width = 5.4 }: { d: string; color: string; width?: number }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={width + 3.2} />
      <path d={d} stroke={color} strokeWidth={width} />
    </g>
  )
}

function Arms({ pose }: { pose: MascotPose }) {
  if (pose === 'peek') return null
  if (pose === 'cheer') {
    return (
      <g className={styles.cheer}>
        <Limb d="M45 80 Q34 70 31 57" color={SKIN} />
        <Limb d="M75 80 Q86 70 89 57" color={SKIN} />
      </g>
    )
  }
  return (
    <g>
      <Limb d="M45 80 Q37.5 89.5 39.5 99" color={SKIN} />
      {pose === 'wave' ? (
        <g className={styles.wave}>
          <Limb d="M75 80 Q86 72 89.5 59" color={SKIN} />
        </g>
      ) : (
        <Limb d="M75 80 Q82.5 89.5 80.5 99" color={SKIN} />
      )}
    </g>
  )
}

function Legs({ pose }: { pose: MascotPose }) {
  if (pose === 'peek') return null
  const swing = pose === 'sit'
  return (
    <g>
      <g className={swing ? styles.legL : undefined}>
        <Limb d="M52.5 101 L51.5 124" color={PANTS} width={6.4} />
        <ellipse cx={50.2} cy={127} rx={6} ry={3.6} fill={SHOE} stroke={INK} strokeWidth={2} />
      </g>
      <g className={swing ? styles.legR : undefined}>
        <Limb d="M67.5 101 L68.5 124" color={PANTS} width={6.4} />
        <ellipse cx={69.8} cy={127} rx={6} ry={3.6} fill={SHOE} stroke={INK} strokeWidth={2} />
      </g>
    </g>
  )
}

function Drawing({
  pose,
  expression,
  look,
  filterId,
  blink,
}: {
  pose: MascotPose
  expression: MascotExpression
  look: number
  filterId: string
  blink: boolean
}) {
  const viewBox = pose === 'peek' ? '14 8 92 76' : pose === 'cheer' || pose === 'wave' ? '14 8 92 126' : '18 8 84 126'
  return (
    <svg viewBox={viewBox} className={styles.svg} aria-hidden="true" focusable="false">
      <defs>
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.6" result="grown" />
          <feFlood floodColor="#fff6ea" />
          <feComposite in2="grown" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        {/* long hair behind everything */}
        <path d="M35.5 42 C31 62 32.5 84 41.5 91 L78.5 91 C87.5 84 89 62 84.5 42 Z" fill={HAIR} stroke={INK} strokeWidth={2.2} />
        <Legs pose={pose} />
        {pose !== 'peek' && (
          <>
            <path d="M42 77 Q60 70.5 78 77 L82.5 102.5 Q60 107 37.5 102.5 Z" fill={TOP} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
            <path d="M54 76.5 Q60 80 66 76.5" stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
            <circle cx={60} cy={90} r={2.2} fill={PETAL} stroke={INK} strokeWidth={1.1} />
          </>
        )}
        <Arms pose={pose} />
        <rect x={55.5} y={66} width={9} height={9} rx={3} fill={SKIN} />
        {/* head */}
        <circle cx={60} cy={46} r={25} fill={SKIN} stroke={INK} strokeWidth={2.4} />
        <ellipse cx={44.5} cy={56.5} rx={4.4} ry={2.6} fill={BLUSH} opacity={expression === 'shocked' ? 0.45 : 0.8} />
        <ellipse cx={75.5} cy={56.5} rx={4.4} ry={2.6} fill={BLUSH} opacity={expression === 'shocked' ? 0.45 : 0.8} />
        <Eyes expression={expression} look={look} blink={blink} />
        <Mouth expression={expression} />
        {/* bangs + side strands */}
        <path
          d="M34.6 46 C34 27 47 19.5 61 19.8 C75.5 20.2 86.6 29.5 85.4 46.5 C81.6 40.2 77 36.4 71.6 34.8 C69.4 38.8 63.4 41.4 56.4 40.8 C50.6 40.4 45 38.6 42.4 36.2 C38.8 39 36.2 42.4 34.6 46 Z"
          fill={HAIR}
          stroke={INK}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <Brows expression={expression} />
        {/* flower clip */}
        <g transform="translate(79 27)">
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.4} cy={Math.sin((a * Math.PI) / 180) * 3.4} r={3} fill={PETAL} stroke={INK} strokeWidth={1} />
          ))}
          <circle r={2} fill={SUN} stroke={INK} strokeWidth={1} />
        </g>
        {pose === 'peek' && (
          <g>
            <circle cx={40} cy={77} r={6.2} fill={SKIN} stroke={INK} strokeWidth={2.2} />
            <circle cx={80} cy={77} r={6.2} fill={SKIN} stroke={INK} strokeWidth={2.2} />
          </g>
        )}
      </g>
    </svg>
  )
}

export const Mascot = memo(function Mascot({
  pose = 'stand',
  expression = 'neutral',
  size = 72,
  animation = 'none',
  animKey,
  look = 0,
  className,
  title,
}: MascotProps) {
  const filterId = `mascot-${useId().replace(/:/g, '')}`
  const reduced = useReducedMotion()
  const sprite = assetFor(pose, expression)
  const blink = useBlink(!sprite && !reduced)
  const ratio = pose === 'peek' ? 92 / 76 : pose === 'stand' || pose === 'sit' ? 84 / 126 : 92 / 126
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      style={{ height: size, width: size * ratio }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <div className={`${styles.bob} ambient`}>
        <m.div
          key={animKey}
          className={styles.fill}
          animate={reduced || animation === 'none' ? undefined : ANIMS[animation]}
          style={{ transformOrigin: '50% 90%' }}
        >
          {sprite ? (
            <img src={sprite} alt="" className={styles.svg} draggable={false} />
          ) : (
            <Drawing pose={pose} expression={expression} look={look} filterId={filterId} blink={blink} />
          )}
        </m.div>
      </div>
    </div>
  )
})
