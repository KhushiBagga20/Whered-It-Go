import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const cloud = Boolean(env.VITE_SUPABASE_URL && (env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY))

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        // App icon files live in public/icons/ (placeholders until the real icon
        // lands — see docs/app-icon.md; `npm run icons` regenerates them).
        includeAssets: ['icons/favicon-32.png', 'icons/favicon-64.png', 'icons/apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Where’dItGo — Love & Loss™',
          short_name: 'Where’dItGo',
          description: 'Where your money goes to disappear beautifully.',
          lang: 'en-IN',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          // 'any': the unfolded Fold is nearly square and works in landscape too
          orientation: 'any',
          background_color: '#1c0a3a',
          theme_color: '#13072a',
          categories: ['finance', 'lifestyle'],
          icons: [
            { src: 'icons/favicon-64.png', sizes: '64x64', type: 'image/png' },
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            {
              name: 'Add evidence',
              short_name: 'Add',
              url: '/?add=expense',
              icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Calendar',
              url: '/calendar',
              icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webp,avif,woff2}'],
          // Only precache what this build can use: Latin fonts, and the
          // Supabase SDK only when cloud sync is configured.
          globIgnores: ['**/*cyrillic*', '**/*vietnamese*', '**/*greek*', ...(cloud ? [] : ['**/supabase-sdk-*.js'])],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/@supabase')) return 'supabase-sdk'
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler'))
              return 'react'
          },
        },
      },
    },
    server: { host: true },
  }
})
