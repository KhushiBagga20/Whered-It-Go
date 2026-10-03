// npm run icons — builds every app icon in public/icons/ from icon-source/.
//
//   icon-source/icon.png            1024×1024, the app icon (square, full-bleed).
//                                   Missing? The placeholder (placeholder.svg) is used.
//   icon-source/icon-maskable.png   optional 1024×1024 hand-made Android adaptive icon.
//                                   Without it, icon.png is shrunk into the safe zone
//                                   on its own background colour.
//
// See docs/app-icon.md.
import { existsSync } from 'node:fs'
import sharp from 'sharp'

const src = existsSync('icon-source/icon.png') ? 'icon-source/icon.png' : 'icon-source/placeholder.svg'
const ownMaskable = existsSync('icon-source/icon-maskable.png') ? 'icon-source/icon-maskable.png' : null
// Android may crop a maskable icon down to its central 80% circle. Shrinking the
// art to this much of the canvas keeps all of it inside that circle.
const SAFE = 0.86

const render = (from, size) =>
  sharp(from, { density: from.endsWith('.svg') ? 72 * (size / 64) : undefined }).resize(size, size, { fit: 'cover' })

// The icon's own background colour: its top-left corner.
const corner = await render(src, 64).removeAlpha().raw().toBuffer()
const background = { r: corner[0], g: corner[1], b: corner[2] }

async function maskable(size) {
  if (ownMaskable) return render(ownMaskable, size).flatten({ background })
  const art = await render(src, Math.round(size * SAFE)).png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 3, background } }).composite([{ input: art, gravity: 'centre' }])
}

const jobs = [
  ['public/icons/icon-192.png', render(src, 192)],
  ['public/icons/icon-512.png', render(src, 512)],
  ['public/icons/icon-maskable-512.png', await maskable(512)],
  ['public/icons/apple-touch-icon.png', render(src, 180).flatten({ background })], // iOS ignores transparency
  ['public/icons/favicon-32.png', render(src, 32)],
  ['public/icons/favicon-64.png', render(src, 64)],
]

const hex = '#' + [background.r, background.g, background.b].map((v) => v.toString(16).padStart(2, '0')).join('')
console.log(`source: ${src}${ownMaskable ? ` (+ ${ownMaskable})` : ''} · background ${hex}`)
for (const [to, img] of jobs) {
  await img.png({ compressionLevel: 9 }).toFile(to)
  console.log('wrote', to)
}
