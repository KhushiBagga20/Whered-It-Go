import { getSupabase } from './supabase'

/**
 * Thin wrappers over Supabase Auth that turn its errors into sentences.
 * The raw message is kept as `detail` so nothing is hidden.
 */
export interface AuthResult {
  ok: boolean
  message?: string
  detail?: string
  /** Sign-up needs an email confirmation before a session exists. */
  confirm?: boolean
  userId?: string
  email?: string
}

function friendly(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match.'
  if (m.includes('email not confirmed')) return 'Confirm your email first — check your inbox.'
  if (m.includes('already registered')) return 'There’s already an account with that email. Sign in instead.'
  if (m.includes('password should be')) return 'Password needs at least 6 characters.'
  if (m.includes('rate limit')) return 'Too many tries. Wait a minute and try again.'
  if (m.includes('fetch')) return 'Couldn’t reach the server. Check your connection.'
  return 'That didn’t work.'
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const sb = await getSupabase()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: friendly(error.message), detail: error.message }
  return { ok: true, userId: data.user.id, email: data.user.email ?? email }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const sb = await getSupabase()
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
  if (error) return { ok: false, message: friendly(error.message), detail: error.message }
  if (!data.session) return { ok: true, confirm: true }
  return { ok: true, userId: data.user?.id, email: data.user?.email ?? email }
}

export async function sendMagicLink(email: string): Promise<AuthResult> {
  const sb = await getSupabase()
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
  if (error) return { ok: false, message: friendly(error.message), detail: error.message }
  return { ok: true, confirm: true }
}
