import type { MascotExpression, MascotPose } from './types'

/**
 * Hand-drawn sprites, loaded by filename from src/assets/mascot/.
 * Drop in `sit-judging.webp`, `peek-shocked.png`, `stand-neutral-blink.webp`…
 * and they're used automatically; nothing to register. See
 * docs/tiny-khushi-art-brief.md for the full list and canvas sizes.
 *
 * Lookup for a pose + expression:
 *   1. "{pose}-{expression}"   exact drawing
 *   2. "{pose}-neutral"        same pose, resting face
 *   3. "{pose}"                a single drawing for that pose
 *   4. nothing → the built-in SVG placeholder
 * An optional "{name}-blink" frame makes that drawing blink now and then.
 */
const files = import.meta.glob<string>('../assets/mascot/*.{png,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const MASCOT_ASSETS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [
    path
      .split('/')
      .pop()!
      .replace(/\.[^.]+$/, '')
      .toLowerCase(),
    url,
  ]),
)

export interface Sprite {
  /** Which file was chosen (for the gallery page). */
  name: string
  src: string
  blink: string | null
}

export function spriteFor(pose: MascotPose, expression: MascotExpression): Sprite | null {
  const name = [`${pose}-${expression}`, `${pose}-neutral`, pose].find((key) => key in MASCOT_ASSETS)
  if (!name) return null
  return { name, src: MASCOT_ASSETS[name], blink: MASCOT_ASSETS[`${name}-blink`] ?? null }
}

/** Canvas proportions (width / height) each pose is drawn at — sprites must match. */
export const POSE_RATIO: Record<MascotPose, number> = {
  stand: 2 / 3,
  sit: 2 / 3,
  wave: 3 / 4,
  cheer: 3 / 4,
  peek: 6 / 5,
}
