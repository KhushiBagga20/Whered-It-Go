// npm run icons — builds every app icon in public/icons/ from icon-source/.
//
//   icon-source/icon.png            1024×1024, your final icon (square, full-bleed).
//                                   Missing? The placeholder (placeholder.svg) is used.
//   icon-source/icon-maskable.png   optional 1024×1024 for Android adaptive icons:
//                                   full-bleed background, important art inside the
//                                   central ~80% circle. Falls back to icon.png.
//
// See docs/app-icon.md.
import { existsSync } from 'node:fs'
import sharp from 'sharp'

const src = existsSync('icon-source/icon.png') ? 'icon-source/icon.png' : 'icon-source/placeholder.svg'
const maskable = existsSync('icon-source/icon-maskable.png') ? 'icon-source/icon-maskable.png' : src
const BG = '#2d1260'

const jobs = [
  [src, 'public/icons/icon-192.png', 192, false],
  [src, 'public/icons/icon-512.png', 512, false],
  [maskable, 'public/icons/icon-maskable-512.png', 512, true],
  [maskable, 'public/icons/apple-touch-icon.png', 180, true], // iOS ignores transparency
  [src, 'public/icons/favicon-32.png', 32, false],
  [src, 'public/icons/favicon-64.png', 64, false],
]

console.log(`source: ${src}${maskable !== src ? ` (+ ${maskable})` : ''}`)
for (const [from, to, size, opaque] of jobs) {
  let img = sharp(from, { density: from.endsWith('.svg') ? 72 * (size / 64) : undefined }).resize(size, size, { fit: 'cover' })
  if (opaque) img = img.flatten({ background: BG })
  await img.png({ compressionLevel: 9 }).toFile(to)
  console.log('wrote', to)
}
