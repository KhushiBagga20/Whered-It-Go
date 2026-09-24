import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// `npm run icons` regenerates every PWA/app icon from public/favicon.svg.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], padding: 0.2, resizeOptions: { background: '#2d1260' } },
    apple: { sizes: [180], padding: 0.2, resizeOptions: { background: '#2d1260' } },
  },
  images: ['public/favicon.svg'],
})
