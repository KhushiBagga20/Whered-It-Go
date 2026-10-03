import type { Person } from '../data/types'
import { getSupabase } from './supabase'

/**
 * Sign-in for the two of them. The PIN is checked server-side by the
 * pin-login Edge Function (bcrypt + lockout in Postgres); the browser only
 * ever receives a normal Supabase session back. Nothing here knows a PIN.
 */

const LAST_PERSON_KEY = 'wig:last-person'

/** Who signed in last on this device, so a lapsed session skips "who are you?". */
export function rememberedPerson(): Person | null {
  try {
    const v = localStorage.getItem(LAST_PERSON_KEY)
    return v === 'jais' || v === 'khushi' ? v : null
  } catch {
    return null
  }
}

/** null forgets — after a deliberate log-out the next person picks themselves. */
export function rememberPerson(p: Person | null) {
  try {
    if (p) localStorage.setItem(LAST_PERSON_KEY, p)
    else localStorage.removeItem(LAST_PERSON_KEY)
  } catch {
    // storage blocked: just ask every time
  }
}

export type PinResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: 'wrong_pin'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; retryAfter: number }
  | { ok: false; reason: 'not_set_up' | 'unavailable' | 'error'; detail?: string }

async function readJson(res: unknown): Promise<Record<string, unknown>> {
  try {
    if (res instanceof Response) return (await res.clone().json()) as Record<string, unknown>
  } catch {
    // not JSON
  }
  return {}
}

export async function signInWithPin(who: Person, pin: string): Promise<PinResult> {
  const sb = await getSupabase()
  const { data, error } = await sb.functions.invoke<{ access_token: string; refresh_token: string }>('pin-login', {
    body: { who, pin },
  })
  if (error) {
    const context = (error as { context?: unknown }).context
    const status = context instanceof Response ? context.status : 0
    const body = await readJson(context)
    if (status === 401) return { ok: false, reason: 'wrong_pin', attemptsLeft: Number(body.attemptsLeft ?? 0) }
    if (status === 429) return { ok: false, reason: 'locked', retryAfter: Number(body.retryAfter ?? 60) }
    if (status === 403) return { ok: false, reason: 'not_set_up' }
    if (status === 404) return { ok: false, reason: 'unavailable', detail: 'The pin-login function isn’t deployed yet.' }
    return { ok: false, reason: status ? 'error' : 'unavailable', detail: error.message }
  }
  if (!data?.access_token || !data.refresh_token) return { ok: false, reason: 'error', detail: 'No session returned.' }
  const { data: session, error: sessionError } = await sb.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (sessionError || !session.user) return { ok: false, reason: 'error', detail: sessionError?.message }
  return { ok: true, userId: session.user.id, email: session.user.email ?? session.user.id }
}

export interface EmailResult {
  ok: boolean
  message?: string
  detail?: string
  userId?: string
  email?: string
}

function friendly(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match.'
  if (m.includes('email not confirmed')) return 'That account isn’t confirmed yet.'
  if (m.includes('rate limit')) return 'Too many tries. Wait a minute and try again.'
  if (m.includes('fetch')) return 'Couldn’t reach the server. Check your connection.'
  return 'That didn’t work.'
}

/** Admin fallback (setting things up, or locked out of PIN login). No sign-ups. */
export async function signInWithEmail(email: string, password: string): Promise<EmailResult> {
  const sb = await getSupabase()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: friendly(error.message), detail: error.message }
  return { ok: true, userId: data.user.id, email: data.user.email ?? email }
}

/** Change your own PIN; the database checks the current one (and counts misses). */
export async function changePin(current: string, next: string): Promise<{ ok: boolean; message: string }> {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc('change_my_pin', { p_current: current, p_new: next })
  if (error) return { ok: false, message: error.message }
  return data ? { ok: true, message: 'PIN changed.' } : { ok: false, message: 'That’s not your current PIN.' }
}
