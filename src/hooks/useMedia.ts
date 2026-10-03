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

/*
 * Layout modes, by available width (never by device model):
 *
 *   cover    < 420px    folded Fold cover screen, small phones — one-handed, tight
 *   phone    420–699    a normal phone
 *   open     700–1023   unfolded Fold / small tablet — compact side rail, two columns
 *   desktop  ≥ 1024     full side rail
 *   wide     ≥ 1280     + the meadow side panel with Khushi
 *
 * Folding/unfolding is just a resize, so everything below re-evaluates live.
 * Component-level layouts use CSS container queries on the content column.
 */
export const COVER_QUERY = '(max-width: 419px)'
export const OPEN_QUERY = '(min-width: 700px)'
export const DESKTOP_QUERY = '(min-width: 1024px)'
export const WIDE_QUERY = '(min-width: 1280px)'

export type LayoutMode = 'cover' | 'phone' | 'open' | 'desktop' | 'wide'

export interface Layout {
  mode: LayoutMode
  /** Navigation lives in a side rail instead of on the hill. */
  rail: boolean
  /** The rail is the slim icon version (open mode). */
  compactRail: boolean
  /** The right-hand meadow panel is shown. */
  aside: boolean
}

export function useLayout(): Layout {
  const cover = useMedia(COVER_QUERY)
  const open = useMedia(OPEN_QUERY)
  const desktop = useMedia(DESKTOP_QUERY)
  const wide = useMedia(WIDE_QUERY)
  const mode: LayoutMode = wide ? 'wide' : desktop ? 'desktop' : open ? 'open' : cover ? 'cover' : 'phone'
  return { mode, rail: open, compactRail: open && !desktop, aside: wide }
}

export const useIsWide = () => useMedia(WIDE_QUERY)
