import { useSyncExternalStore } from 'react'

const subscribers = new Map<string, (cb: () => void) => () => void>()

function subscribeTo(query: string) {
  let sub = subscribers.get(query)
  if (!sub) {
    sub = (cb: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    }
    subscribers.set(query, sub)
  }
  return sub
}

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Desktop with the environment side panel. */
export const WIDE_QUERY = '(min-width: 1280px)'
/** Desktop with the left navigation rail. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

export const useIsWide = () => useMedia(WIDE_QUERY)
export const useIsDesktop = () => useMedia(DESKTOP_QUERY)
