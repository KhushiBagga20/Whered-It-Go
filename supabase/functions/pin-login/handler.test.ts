import { describe, expect, it, vi } from 'vitest'
import { corsHeaders, handlePinLogin, type MinimalClient, type PinLoginDeps } from './handler.ts'

type Row = { ok: boolean; uid: string | null; retry_after: number; attempts_left: number }

function deps(row: Row | null, overrides: Partial<MinimalClient['auth']> = {}) {
  const calls: { rpc: unknown[]; keys: string[] } = { rpc: [], keys: [] }
  const client = (key: string): MinimalClient => {
    calls.keys.push(key)
    return {
      rpc: (fn, args) => {
        calls.rpc.push([fn, args])
        return Promise.resolve({ data: row ? [row] : [], error: null })
      },
      auth: {
        admin: {
          getUserById: () => Promise.resolve({ data: { user: { email: 'jais@x.in' } }, error: null }),
          generateLink: () => Promise.resolve({ data: { properties: { hashed_token: 'hash' } }, error: null }),
        },
        verifyOtp: () =>
          Promise.resolve({ data: { session: { access_token: 'access', refresh_token: 'refresh' } }, error: null }),
        ...overrides,
      },
    }
  }
  const d: PinLoginDeps = {
    url: 'https://x.supabase.co',
    serviceKey: 'service',
    anonKey: 'anon',
    allowedOrigins: '*',
    createClient: (_url, key) => client(key),
  }
  return { d, calls }
}

const post = (body: unknown, origin = 'https://app.test') =>
  new Request('https://fn.test/pin-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

describe('pin-login', () => {
  it('returns a session for the right PIN', async () => {
    const { d, calls } = deps({ ok: true, uid: 'u1', retry_after: 0, attempts_left: 5 })
    const res = await handlePinLogin(post({ who: 'jais', pin: '4821' }), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ access_token: 'access', refresh_token: 'refresh' })
    expect(calls.rpc).toEqual([['pin_login_check', { p_person: 'jais', p_pin: '4821' }]])
    expect(calls.keys).toEqual(['service', 'anon']) // service role only for the check + admin calls
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('says how many tries are left on a wrong PIN', async () => {
    const { d } = deps({ ok: false, uid: null, retry_after: 0, attempts_left: 3 })
    const res = await handlePinLogin(post({ who: 'khushi', pin: '0000' }), d)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'wrong_pin', attemptsLeft: 3 })
  })

  it('reports a lockout with Retry-After', async () => {
    const { d } = deps({ ok: false, uid: null, retry_after: 300, attempts_left: 0 })
    const res = await handlePinLogin(post({ who: 'jais', pin: '0000' }), d)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('300')
    expect(await res.json()).toEqual({ error: 'locked', retryAfter: 300 })
  })

  it('says when no PIN has been set up', async () => {
    const { d } = deps({ ok: false, uid: null, retry_after: 0, attempts_left: -1 })
    const res = await handlePinLogin(post({ who: 'jais', pin: '1111' }), d)
    expect(res.status).toBe(403)
  })

  it('rejects anything that isn’t exactly who + 4 digits, before touching the database', async () => {
    const bad = [
      { who: 'jais', pin: '123' },
      { who: 'jais', pin: '12345' },
      { who: 'jais', pin: 1234 },
      { who: 'admin', pin: '1234' },
      { who: 'jais', pin: "1' or '1'='1" },
      'not json',
      null,
    ]
    for (const body of bad) {
      const { d, calls } = deps({ ok: true, uid: 'u1', retry_after: 0, attempts_left: 5 })
      const res = await handlePinLogin(post(body), d)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(calls.rpc).toEqual([])
    }
  })

  it('never leaks internal errors', async () => {
    const log = vi.fn()
    const { d } = deps({ ok: true, uid: 'u1', retry_after: 0, attempts_left: 5 }, {
      verifyOtp: () => Promise.resolve({ data: null, error: { message: 'secret internals' } }),
    })
    const res = await handlePinLogin(post({ who: 'jais', pin: '4821' }), { ...d, log })
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('secret')
    expect(log).toHaveBeenCalled()
  })

  it('handles preflight and other methods', async () => {
    const { d } = deps(null)
    const pre = await handlePinLogin(new Request('https://fn.test', { method: 'OPTIONS' }), d)
    expect(pre.status).toBe(200)
    const get = await handlePinLogin(new Request('https://fn.test', { method: 'GET' }), d)
    expect(get.status).toBe(405)
  })

  it('only echoes allowed origins when a list is configured', () => {
    expect(corsHeaders('https://a.app', 'https://a.app, http://localhost:5173')['Access-Control-Allow-Origin']).toBe('https://a.app')
    expect(corsHeaders('https://evil.app', 'https://a.app')['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeaders(null, '*')['Access-Control-Allow-Origin']).toBe('*')
  })
})
