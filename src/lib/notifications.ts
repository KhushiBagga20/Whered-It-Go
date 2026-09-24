import type { NotificationPrefs, Transaction } from '../data/types'
import { formatINR, sumRupees } from './money'
import { todayKey, toTimeKey } from './dates'

/**
 * Notifications, built as a small pipeline so new delivery channels can be
 * added without touching the rest of the app:
 *
 *   evaluateNudges(state)  → which nudge (if any) is due      (pure)
 *   NUDGE_LINES            → what it says                     (data)
 *   deliver(nudge)         → how it reaches the phone         (channel)
 *
 * Today the channel is the service worker's showNotification, fired while
 * the app is open or alive in the background. A server-side push channel
 * (Supabase Edge Function + Web Push) can call the same evaluate/lines
 * later; see README → Notifications.
 */

export type NudgeKind = 'evening' | 'big-day' | 'saving'

export const NUDGE_LINES: Record<NudgeKind, string[]> = {
  evening: ['yo where ur money go?', 'You haven’t logged anything today 👀', 'nothing logged today. suspicious.'],
  'big-day': ['{amount} disappeared today.', '{amount} today. she saw.'],
  saving: ['look at you saving money 🫡', 'a no-spend day. character development.'],
}

export interface Nudge {
  kind: NudgeKind
  title: string
  body: string
}

export type PermissionState = 'unsupported' | NotificationPermission

export function permissionState(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestPermission(): Promise<PermissionState> {
  if (permissionState() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return permissionState()
  }
}

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)]

function line(kind: NudgeKind, amount = 0): string {
  return pick(NUDGE_LINES[kind]).replace('{amount}', formatINR(amount))
}

const SENT_KEY = 'wig:nudges-sent'

function sentToday(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function markSent(kind: NudgeKind, day: string) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify({ ...sentToday(), [kind]: day }))
  } catch {
    // best-effort
  }
}

/** Pure: given the data and prefs, which nudge is due right now? At most one of each kind per day. */
export function evaluateNudges(
  txns: readonly Transaction[],
  prefs: NotificationPrefs,
  now = new Date(),
  sent: Record<string, string> = sentToday(),
): Nudge | null {
  if (!prefs.enabled) return null
  const today = todayKey(now)
  const time = toTimeKey(now)
  const todays = txns.filter((t) => t.date === today)
  const spent = sumRupees(todays.filter((t) => t.type === 'expense').map((t) => t.amount))

  if (prefs.bigDayAlert && spent >= prefs.bigDayThreshold && sent['big-day'] !== today) {
    return { kind: 'big-day', title: 'Where’dItGo', body: line('big-day', spent) }
  }
  if (time < prefs.nudgeTime) return null
  if (todays.length === 0) {
    // Nothing logged: saving or forgetting? Ask.
    if (prefs.eveningNudge && sent.evening !== today) return { kind: 'evening', title: 'Where’dItGo', body: line('evening') }
  } else if (spent === 0 && prefs.celebrateSaving && sent.saving !== today) {
    return { kind: 'saving', title: 'Where’dItGo', body: line('saving') }
  }
  return null
}

/** Channel: the service worker (required on Android), falling back to the page API. */
export async function deliver(nudge: Nudge, { record = true }: { record?: boolean } = {}): Promise<boolean> {
  if (permissionState() !== 'granted') return false
  const options: NotificationOptions = {
    body: nudge.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    tag: `wig-${nudge.kind}`,
  }
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) await reg.showNotification(nudge.title, options)
    else new Notification(nudge.title, options)
    if (record) markSent(nudge.kind, todayKey())
    return true
  } catch {
    return false
  }
}

export function testNudge(): Nudge {
  return { kind: 'evening', title: 'Where’dItGo', body: line('evening') }
}

/** Checks once a minute while the app is alive. Returns a stop function. */
export function startNudgeWatcher(getState: () => { txns: readonly Transaction[]; prefs: NotificationPrefs }): () => void {
  const tick = () => {
    const { txns, prefs } = getState()
    const due = evaluateNudges(txns, prefs)
    if (due) void deliver(due)
  }
  const id = window.setInterval(tick, 60_000)
  const onVisible = () => document.visibilityState === 'visible' && tick()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.clearInterval(id)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
