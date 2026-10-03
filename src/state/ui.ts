import { create } from 'zustand'
import type { DateKey, MonthKey, TransactionDraft } from '../data/types'
import { currentMonthKey } from '../lib/dates'
import type { MascotAnimation, MascotExpression } from '../mascot/types'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error' | 'success'
  detail?: string
  action?: { label: string; run: () => void }
  /** Stays until it's tapped or dismissed, and newer toasts never push it out. */
  sticky?: boolean
}

export interface ActiveReaction {
  id: number
  message: string
  expression: MascotExpression
  animation: MascotAnimation
}

export interface Burst {
  id: number
  kind: 'spent' | 'received'
  x: number
  y: number
}

export interface ComposerState {
  open: boolean
  editId: string | null
  preset: Partial<TransactionDraft> | null
  /** Bumped on every open so the form starts fresh. */
  seq: number
}

interface UiState {
  month: MonthKey
  /** Direction of the last month change, for slide animations. */
  monthDir: 1 | -1
  composer: ComposerState
  detailId: string | null
  /** History's split view is showing the detail inline (so the sheet stays shut). */
  inlineDetail: boolean
  day: DateKey | null
  toasts: Toast[]
  reaction: ActiveReaction | null
  /** Stack of mounted mascot spots; the last one is where she currently is. */
  mascotSpots: string[]
  bursts: Burst[]
  /** Bumped on month change so the world can do a little gust. */
  gust: number
}

let seq = 1
let canCreate: (() => boolean) | null = null

export const useUi = create<UiState>(() => ({
  month: currentMonthKey(),
  monthDir: 1,
  composer: { open: false, editId: null, preset: null, seq: 0 },
  detailId: null,
  inlineDetail: false,
  day: null,
  toasts: [],
  reaction: null,
  mascotSpots: [],
  bursts: [],
  gust: 0,
}))

export const ui = {
  setMonth(month: MonthKey) {
    const prev = useUi.getState().month
    if (prev === month) return
    useUi.setState((s) => ({ month, monthDir: month > prev ? 1 : -1, gust: s.gust + 1 }))
  },
  openComposer(preset: Partial<TransactionDraft> | null = null) {
    if (canCreate && !canCreate()) {
      ui.toast('Only Jais can add transactions. You can fix them and leave notes.')
      return
    }
    useUi.setState((s) => ({ composer: { open: true, editId: null, preset, seq: s.composer.seq + 1 } }))
  },
  /** Wired by the data store so ui.ts doesn't import it (avoids a cycle). */
  setCreateGuard(fn: () => boolean) {
    canCreate = fn
  },
  editTransaction(id: string) {
    useUi.setState((s) => ({ composer: { open: true, editId: id, preset: null, seq: s.composer.seq + 1 } }))
  },
  closeComposer() {
    useUi.setState((s) => ({ composer: { ...s.composer, open: false } }))
  },
  showDetail(id: string | null) {
    useUi.setState({ detailId: id })
  },
  setInlineDetail(inline: boolean) {
    useUi.setState({ inlineDetail: inline })
  },
  showDay(day: DateKey | null) {
    useUi.setState({ day })
  },
  toast(message: string, opts: Partial<Omit<Toast, 'id' | 'message'>> = {}) {
    const id = seq++
    const toast: Toast = { id, message, tone: opts.tone ?? 'info', detail: opts.detail, action: opts.action, sticky: opts.sticky }
    useUi.setState((s) => ({
      toasts: [...s.toasts.filter((t) => t.sticky), ...s.toasts.filter((t) => !t.sticky).slice(-2), toast],
    }))
    if (!toast.sticky) {
      const ttl = toast.tone === 'error' ? 9000 : toast.action ? 6000 : 3200
      window.setTimeout(() => ui.dismissToast(id), ttl)
    }
    return id
  },
  dismissToast(id: number) {
    useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
  say(reaction: Omit<ActiveReaction, 'id'>, ttl = 3400) {
    const id = seq++
    useUi.setState({ reaction: { ...reaction, id } })
    window.setTimeout(() => {
      if (useUi.getState().reaction?.id === id) useUi.setState({ reaction: null })
    }, ttl)
  },
  hush() {
    useUi.setState({ reaction: null })
  },
  enterSpot(id: string) {
    useUi.setState((s) => ({ mascotSpots: [...s.mascotSpots.filter((x) => x !== id), id] }))
  },
  leaveSpot(id: string) {
    useUi.setState((s) => ({ mascotSpots: s.mascotSpots.filter((x) => x !== id) }))
  },
  burst(kind: Burst['kind'], x: number, y: number) {
    const id = seq++
    useUi.setState((s) => ({ bursts: [...s.bursts, { id, kind, x, y }] }))
    window.setTimeout(() => useUi.setState((s) => ({ bursts: s.bursts.filter((b) => b.id !== id) })), 1600)
  },
}
