import { ui } from '../state/ui'

/**
 * Registers the service worker (precached app shell → opens offline).
 * When a new version is ready we ask before swapping, so an update never
 * lands mid-entry.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh() {
        ui.toast('A fresh version of the meadow is ready.', {
          action: { label: 'Reload', run: () => void update(true) },
        })
      },
      onOfflineReady() {
        ui.toast('Works offline now.', { tone: 'success' })
      },
    })
  })
}
