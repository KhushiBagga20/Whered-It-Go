import { AnimatePresence, m } from 'motion/react'
import { useEffect, useId } from 'react'
import { useIsWide } from '../hooks/useMedia'
import { useData } from '../state/store'
import { ui, useUi } from '../state/ui'
import { Mascot } from './Mascot'
import styles from './MascotSpot.module.css'
import { react } from './react'
import type { MascotExpression, MascotPose } from './types'

export interface MascotSpotProps {
  pose?: MascotPose
  /** Her resting face when she isn't reacting to something. */
  expression?: MascotExpression
  size?: number
  look?: number
  bubble?: 'left' | 'right' | 'top'
  /** Also appear on wide desktop (otherwise the side panel hosts her there). */
  desktop?: boolean
  className?: string
  /** Pokeable spots are buttons; decorative ones aren't. */
  pokeable?: boolean
  /**
   * Her home base (on the hill, or the desktop side panel). The stage
   * doesn't register as a spot; it shows whenever no spot is claiming her.
   */
  stage?: boolean
  /** Set false to have her leave right away (e.g. while a sheet animates closed). */
  present?: boolean
}

/**
 * A place she can be. Spots register themselves; only the most recently
 * mounted one actually shows her, so she "moves" around the app instead of
 * cloning herself. Reactions appear wherever she currently is.
 */
export function MascotSpot({
  pose = 'sit',
  expression = 'neutral',
  size = 56,
  look = 0,
  bubble = 'left',
  desktop = false,
  className,
  pokeable = true,
  stage = false,
  present = true,
}: MascotSpotProps) {
  const id = useId()
  const wide = useIsWide()
  const visible = useData((s) => s.profile.prefs.mascotVisible)
  const name = useData((s) => s.profile.mascotName)
  const enabled = present && visible && (stage || desktop || !wide)
  const active = useUi((s) => (stage ? s.mascotSpots.length === 0 : s.mascotSpots[s.mascotSpots.length - 1] === id))
  const reaction = useUi((s) => s.reaction)

  useEffect(() => {
    if (!enabled || stage) return
    ui.enterSpot(id)
    return () => ui.leaveSpot(id)
  }, [enabled, stage, id])

  if (!enabled) return null

  const shown = active ? reaction : null
  const body = (
    <Mascot
      pose={pose}
      expression={shown?.expression ?? expression}
      animation={shown?.animation ?? 'none'}
      animKey={shown?.id}
      size={size}
      look={look}
    />
  )

  return (
    <AnimatePresence>
      {active && (
        <m.div
          className={[styles.spot, className].filter(Boolean).join(' ')}
          initial={{ opacity: 0, y: 14, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          <SpeechBubble message={shown?.message ?? null} id={shown?.id} side={bubble} />
          {pokeable ? (
            <button type="button" className={styles.poke} onClick={() => react('poke')} aria-label={`Poke ${name}`}>
              {body}
            </button>
          ) : (
            body
          )}
        </m.div>
      )}
    </AnimatePresence>
  )
}

export function SpeechBubble({ message, id, side }: { message: string | null; id?: number; side: 'left' | 'right' | 'top' }) {
  return (
    <AnimatePresence>
      {message && (
        <m.div
          key={id}
          className={`${styles.bubble} ${styles[side]}`}
          initial={{ opacity: 0, scale: 0.6, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.14 } }}
          transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          onClick={() => ui.hush()}
        >
          <span>{message}</span>
        </m.div>
      )}
    </AnimatePresence>
  )
}
