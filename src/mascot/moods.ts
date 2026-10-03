import type { MascotAnimation, MascotExpression, Mood } from './types'

/**
 * Mood → how she shows it. Kept to the 8 drawable faces so every reaction
 * works with the hand-drawn sprites too.
 */
export const MOODS: Record<Mood, { expression: MascotExpression; animation: MascotAnimation }> = {
  chill: { expression: 'neutral', animation: 'nod' },
  suspicious: { expression: 'suspicious', animation: 'nod' },
  judging: { expression: 'judging', animation: 'shake' },
  concerned: { expression: 'shocked', animation: 'nod' },
  proud: { expression: 'proud', animation: 'hop' },
  impressed: { expression: 'happy', animation: 'spin' },
  devastated: { expression: 'shocked', animation: 'faint' },
  evil: { expression: 'proud', animation: 'wiggle' },
}
