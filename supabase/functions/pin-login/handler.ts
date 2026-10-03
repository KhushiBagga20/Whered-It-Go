/**
 * pin-login: trades "who + 4-digit PIN" for a real Supabase session.
 *
 *   1. public.pin_login_check() (service role) compares the PIN with the
 *      bcrypt hash in private.pin_credentials and applies the lockout.
 *   2. On success, an admin magic-link token is minted for that user and
 *      immediately exchanged for a session — no email is ever sent.
 *   3. The browser receives access + refresh tokens and calls setSession.
 *
 * The PIN never touches the database in plain text beyond the bcrypt
 * comparison, and nothing here trusts the client beyond the two fields.
 * Kept free of Deno APIs so it can be unit-tested in Node.
 */

export type Person = 'jais' | 'khushi'

interface RpcResult {
  data: unknown
  error: { message: string } | null
}

/** The slice of supabase-js this function uses (keeps tests honest). */
export interface MinimalClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<RpcResult>
  auth: {
    admin: {
      getUserById(id: string): PromiseLike<{ data: { user: { email?: string | null } | null }; error: { message: string } | null }>
      generateLink(params: { type: 'magiclink'; email: string }): PromiseLike<{
        data: { properties?: { hashed_token?: string } | null } | null
        error: { message: string } | null
      }>
    }
    verifyOtp(params: { type: 'magiclink' | 'email'; token_hash: string }): PromiseLike<{
      data: { session: { access_token: string; refresh_token: string } | null } | null
      error: { message: string } | null
    }>
  }
}

export interface PinLoginDeps {
  url: string
  serviceKey: string
  anonKey: string
  /** '*' or a comma-separated list of allowed origins. */
  allowedOrigins: string
  createClient: (url: string, key: string, options: Record<string, unknown>) => MinimalClient
  log?: (message: string, detail?: unknown) => void
}

interface CheckRow {
  ok: boolean
  uid: string | null
  retry_after: number
  attempts_left: number
}

const PEOPLE: Person[] = ['jais', 'khushi']
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

export function corsHeaders(origin: string | null, allowed: string): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
  if (allowed.trim() === '*') return { ...base, 'Access-Control-Allow-Origin': '*' }
  const list = allowed.split(',').map((s) => s.trim()).filter(Boolean)
  if (origin && list.includes(origin)) return { ...base, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
  return { ...base, Vary: 'Origin' }
}

export async function handlePinLogin(req: Request, deps: PinLoginDeps): Promise<Response> {
  const cors = corsHeaders(req.headers.get('origin'), deps.allowedOrigins)
  const json = (status: number, body: Record<string, unknown>, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, ...extra, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let who: unknown
  let pin: unknown
  try {
    const body = (await req.json()) as { who?: unknown; pin?: unknown }
    who = body?.who
    pin = body?.pin
  } catch {
    return json(400, { error: 'bad_request' })
  }
  if (typeof who !== 'string' || !PEOPLE.includes(who as Person) || typeof pin !== 'string' || !/^[0-9]{4}$/.test(pin)) {
    return json(400, { error: 'bad_request' })
  }

  const log = deps.log ?? (() => undefined)
  try {
    const admin = deps.createClient(deps.url, deps.serviceKey, NO_SESSION)
    const check = await admin.rpc('pin_login_check', { p_person: who, p_pin: pin })
    if (check.error) {
      log('pin_login_check failed', check.error.message)
      return json(500, { error: 'server_error' })
    }
    const row = (Array.isArray(check.data) ? check.data[0] : check.data) as CheckRow | undefined
    if (!row) return json(500, { error: 'server_error' })

    if (!row.ok) {
      if (row.attempts_left === -1) return json(403, { error: 'not_set_up' })
      if (row.retry_after > 0) {
        return json(429, { error: 'locked', retryAfter: row.retry_after }, { 'Retry-After': String(row.retry_after) })
      }
      return json(401, { error: 'wrong_pin', attemptsLeft: row.attempts_left })
    }

    const user = await admin.auth.admin.getUserById(row.uid!)
    const email = user.data.user?.email
    if (user.error || !email) {
      log('getUserById failed', user.error?.message)
      return json(500, { error: 'server_error' })
    }

    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = link.data?.properties?.hashed_token
    if (link.error || !tokenHash) {
      log('generateLink failed', link.error?.message)
      return json(500, { error: 'server_error' })
    }

    const anon = deps.createClient(deps.url, deps.anonKey, NO_SESSION)
    let verified = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (verified.error) verified = await anon.auth.verifyOtp({ type: 'email', token_hash: tokenHash })
    const session = verified.data?.session
    if (verified.error || !session) {
      log('verifyOtp failed', verified.error?.message)
      return json(500, { error: 'server_error' })
    }

    return json(200, { access_token: session.access_token, refresh_token: session.refresh_token })
  } catch (e) {
    log('unexpected', e instanceof Error ? e.message : String(e))
    return json(500, { error: 'server_error' })
  }
}
