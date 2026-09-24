// Rasterises the app icons. Run via `npm run icons` (after pwa-assets-generator makes favicon.ico).
import sharp from 'sharp'

const jobs = [
  ['public/favicon.svg', 'public/pwa-64x64.png', 64],
  ['public/favicon.svg', 'public/pwa-192x192.png', 192],
  ['public/favicon.svg', 'public/pwa-512x512.png', 512],
  ['public/icon-fullbleed.svg', 'public/maskable-icon-512x512.png', 512],
  ['public/icon-fullbleed.svg', 'public/apple-touch-icon-180x180.png', 180],
]

for (const [src, out, size] of jobs) {
  await sharp(src, { density: 72 * (size / 64) * 2 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out)
  console.log('wrote', out)
}
