import type { Transition, Variants } from 'motion/react'

/** Shared motion vocabulary so the whole app moves with one personality. */

export const springy: Transition = { type: 'spring', stiffness: 420, damping: 30 }
export const soft: Transition = { type: 'spring', stiffness: 260, damping: 28 }

/** Pages slide in the direction of travel along the nav. */
export const pageVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 28, scale: 0.985 }),
  center: { opacity: 1, x: 0, scale: 1, transition: { ...soft, opacity: { duration: 0.2 } } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -28, scale: 0.985, transition: { duration: 0.16 } }),
}

/** Month content re-flows sideways when the month changes. */
export const monthSwap: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 36 }),
  center: { opacity: 1, x: 0, transition: soft },
  exit: (dir: number) => ({ opacity: 0, x: dir * -36, transition: { duration: 0.14 } }),
}

export const listItem: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: springy },
  exit: { opacity: 0, x: -60, scale: 0.9, transition: { duration: 0.22 } },
}

export const stagger = (step = 0.035, delay = 0): Variants => ({
  animate: { transition: { staggerChildren: step, delayChildren: delay } },
})

export const rise: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: soft },
}
