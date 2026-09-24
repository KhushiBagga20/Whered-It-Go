import type { MascotExpression, MascotPose } from './types'

/**
 * Custom sprite hook-up. The SVG drawing in Mascot.tsx is a placeholder;
 * to use real illustrations, put files in /public/mascot/ and register
 * them here. Lookup order: "pose-expression", then "pose", then "*".
 *
 *   export const MASCOT_ASSETS = {
 *     'sit-judging': '/mascot/sit-judging.webp',
 *     'peek': '/mascot/peek.webp',
 *   }
 *
 * Anything not registered keeps using the drawing, so you can swap
 * sprites in one at a time.
 */
export const MASCOT_ASSETS: Readonly<Record<string, string>> = {}

export function assetFor(pose: MascotPose, expression: MascotExpression): string | null {
  return MASCOT_ASSETS[`${pose}-${expression}`] ?? MASCOT_ASSETS[pose] ?? MASCOT_ASSETS['*'] ?? null
}
