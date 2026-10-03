/**
 * Runs every migration against real Postgres (PGlite, in-process) with a
 * small stand-in for Supabase's auth schema, then checks what Jais, Khushi
 * and a stranger can and can't do. These are the actual security rules.
 */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const MIGRATIONS = join(__dirname, '..', 'migrations')

const JAIS = '11111111-1111-4111-8111-111111111111'
const KHUSHI = '22222222-2222-4222-8222-222222222222'
const STRANGER = '33333333-3333-4333-8333-333333333333'
const ACCOUNT = 'aaaaaaaa-0000-4000-8000-000000000001'
const FOOD = 'cccccccc-0000-4000-8000-000000000001'
const FAMILY = 'cccccccc-0000-4000-8000-000000000002'
const TX = 'dddddddd-0000-4000-8000-000000000001'

let db: PGlite

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  const role = uid ? 'authenticated' : 'anon'
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`)
  try {
    return await db.query<T>(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

async function asService<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role service_role;`)
  try {
    return await db.query<T>(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

/** Must fail because of a security rule, not some unrelated error. */
const rejects = (p: Promise<unknown>) => expect(p).rejects.toThrow(/row-level security|permission denied|cannot move|42501/)

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema extensions;
    create table auth.users (id uuid primary key, email text unique);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, extensions, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `)
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
  await db.exec(`grant usage on schema extensions to service_role, authenticated;`)
  await db.exec(`insert into auth.users values ('${JAIS}', 'jais@x.in'), ('${KHUSHI}', 'khushi@x.in'), ('${STRANGER}', 'stranger@x.in')`)
  await db.exec(`select private.setup_ledger('jais@x.in', 'khushi@x.in')`)
  await db.exec(`select private.set_pin('jais', '4821'); select private.set_pin('khushi', '1306');`)

  await as(JAIS, `insert into accounts (id, user_id, name, kind, opening_balance) values ($1, $2, 'UPI', 'upi', 1400)`, [ACCOUNT, JAIS])
  await as(
    JAIS,
    `insert into categories (id, user_id, key, name, kind) values ($1, $3, 'food', 'Food', 'expense'), ($2, $3, 'family', 'Family', 'income')`,
    [FOOD, FAMILY, JAIS],
  )
  await as(
    JAIS,
    `insert into transactions (id, user_id, type, amount, category_id, description, account_id, date, time, created_by)
     values ($1, $2, 'expense', 320, $3, 'McDonald''s', $4, '2026-09-23', '20:42', $5)`,
    [TX, JAIS, FOOD, ACCOUNT, KHUSHI],
  )
}, 60_000)

const insertTx = (uid: string, owner: string, amount = 50) =>
  as(
    uid,
    `insert into transactions (user_id, type, amount, category_id, account_id, date, time) values ($1, 'expense', $2, $3, $4, '2026-09-24', '10:00')`,
    [owner, amount, FOOD, ACCOUNT],
  )

describe('migrations', () => {
  it('apply cleanly a second time', async () => {
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
    }
  })

  it('link the two people', async () => {
    const m = await db.query<{ owner_id: string; member_id: string }>('select owner_id, member_id from ledger_members')
    expect(m.rows).toEqual([{ owner_id: JAIS, member_id: KHUSHI }])
    const p = await db.query<{ person: string }>('select person from profiles where person is not null order by person')
    expect(p.rows.map((r) => r.person)).toEqual(['jais', 'khushi'])
  })

  it('stamp created_by from the session, not the client', async () => {
    const r = await db.query<{ created_by: string }>('select created_by from transactions where id = $1', [TX])
    expect(r.rows[0].created_by).toBe(JAIS)
  })
})

describe('Jais (owner)', () => {
  it('reads, creates, edits and deletes his transactions', async () => {
    expect((await as(JAIS, 'select id from transactions')).rows.length).toBeGreaterThan(0)
    await insertTx(JAIS, JAIS, 75)
    const u = await as(JAIS, `update transactions set amount = 80 where amount = 75 returning id`)
    expect(u.rows.length).toBe(1)
    const d = await as(JAIS, `delete from transactions where amount = 80 returning id`)
    expect(d.rows.length).toBe(1)
  })

  it('manages accounts and categories', async () => {
    await as(JAIS, `insert into accounts (user_id, name, kind) values ($1, 'Cash', 'cash')`, [JAIS])
    await as(JAIS, `insert into categories (user_id, name, kind) values ($1, 'F1', 'expense')`, [JAIS])
  })

  it('reads comments but cannot write them', async () => {
    await rejects(as(JAIS, `insert into transaction_comments (transaction_id, comment) values ($1, 'mine')`, [TX]))
  })
})

describe('Khushi (observer)', () => {
  it('sees Jais’s whole ledger', async () => {
    for (const table of ['transactions', 'accounts', 'categories']) {
      const r = await as<{ n: number }>(KHUSHI, `select count(*)::int n from ${table} where user_id = $1`, [JAIS])
      expect(r.rows[0].n, table).toBeGreaterThan(0)
    }
    const p = await as<{ id: string }>(KHUSHI, 'select id from profiles order by id')
    expect(p.rows.map((r) => r.id)).toEqual([JAIS, KHUSHI])
  })

  it('edits an existing transaction, and the edit is attributed to her', async () => {
    const r = await as(KHUSHI, `update transactions set amount = 420, description = 'McD (large fries)' where id = $1 returning id`, [TX])
    expect(r.rows.length).toBe(1)
    const row = await db.query<{ updated_by: string; created_by: string }>('select updated_by, created_by from transactions where id = $1', [TX])
    expect(row.rows[0]).toEqual({ updated_by: KHUSHI, created_by: JAIS })
    const log = await db.query<{ actor_id: string; metadata: { changes: Record<string, unknown> } }>(
      `select actor_id, metadata from activity_log where action = 'transaction_updated' and entity_id = $1 order by created_at desc limit 1`,
      [TX],
    )
    expect(log.rows[0].actor_id).toBe(KHUSHI)
    expect(Object.keys(log.rows[0].metadata.changes).sort()).toEqual(['amount', 'description'])
  })

  it('cannot create transactions — in his ledger or her own', async () => {
    await rejects(insertTx(KHUSHI, JAIS))
    // Give her a category + account of her own (as admin) so only RLS can stop her.
    const own = await db.query<{ a: string; c: string }>(
      `with a as (insert into accounts (user_id, name, kind) values ($1, 'Hers', 'cash') returning id),
            c as (insert into categories (user_id, name, kind) values ($1, 'Hers', 'expense') returning id)
       select a.id a, c.id c from a, c`,
      [KHUSHI],
    )
    const { a, c } = own.rows[0]
    await expect(
      as(
        KHUSHI,
        `insert into transactions (user_id, type, amount, category_id, account_id, date, time) values ($1, 'expense', 5, $2, $3, '2026-09-24', '10:00')`,
        [KHUSHI, c, a],
      ),
    ).rejects.toThrow(/row-level security/)
  })

  it('cannot delete transactions', async () => {
    const d = await as(KHUSHI, `delete from transactions where id = $1 returning id`, [TX])
    expect(d.rows.length).toBe(0)
    expect((await db.query('select 1 from transactions where id = $1', [TX])).rows.length).toBe(1)
  })

  it('cannot move a transaction into another ledger or fake its author', async () => {
    await rejects(as(KHUSHI, `update transactions set user_id = $1 where id = $2`, [KHUSHI, TX]))
    await as(KHUSHI, `update transactions set created_by = $1 where id = $2`, [KHUSHI, TX])
    const r = await db.query<{ created_by: string }>('select created_by from transactions where id = $1', [TX])
    expect(r.rows[0].created_by).toBe(JAIS)
  })

  it('cannot manage accounts, categories or month settings', async () => {
    await rejects(as(KHUSHI, `insert into accounts (user_id, name, kind) values ($1, 'Mine', 'cash')`, [JAIS]))
    await rejects(as(KHUSHI, `insert into categories (user_id, name, kind) values ($1, 'Mine', 'expense')`, [KHUSHI]))
    const u = await as(KHUSHI, `update accounts set opening_balance = 1 where id = $1 returning id`, [ACCOUNT])
    expect(u.rows.length).toBe(0)
    await rejects(
      as(KHUSHI, `insert into monthly_settings (user_id, month, start_adjustment, adjustment_account_id) values ($1, '2026-09', 5, $2)`, [JAIS, ACCOUNT]),
    )
  })

  it('leaves permanent comments that can’t be edited or deleted', async () => {
    const c = await as<{ id: string; author_id: string }>(
      KHUSHI,
      `insert into transaction_comments (transaction_id, comment, author_id) values ($1, '  you could''ve told me 😭  ', $2) returning id, author_id`,
      [TX, JAIS],
    )
    expect(c.rows[0].author_id).toBe(KHUSHI) // author comes from the session
    await rejects(as(KHUSHI, `update transaction_comments set comment = 'nvm'`))
    await rejects(as(KHUSHI, `delete from transaction_comments`))
    const seen = await as<{ comment: string }>(JAIS, 'select comment from transaction_comments where transaction_id = $1', [TX])
    expect(seen.rows[0].comment).toBe("you could've told me 😭")
    const log = await as(JAIS, `select 1 from activity_log where action = 'comment_added'`)
    expect(log.rows.length).toBe(1)
  })

  it('cannot write the activity log or her own role', async () => {
    await rejects(
      as(KHUSHI, `insert into activity_log (ledger_owner_id, action, entity_type, entity_id) values ($1, 'comment_added', 'comment', $2)`, [JAIS, TX]),
    )
    await rejects(as(KHUSHI, `update profiles set person = 'jais' where id = $1`, [KHUSHI]))
    await rejects(as(KHUSHI, `insert into ledger_members (owner_id, member_id) values ($1, $2)`, [KHUSHI, STRANGER]))
    const u = await as(KHUSHI, `update profiles set display_name = 'hacked' where id = $1 returning id`, [JAIS])
    expect(u.rows.length).toBe(0)
  })
})

describe('a stranger', () => {
  it('sees nothing and changes nothing', async () => {
    for (const table of ['transactions', 'accounts', 'categories', 'transaction_comments', 'activity_log', 'ledger_members']) {
      const r = await as<{ n: number }>(STRANGER, `select count(*)::int n from ${table}`)
      expect(r.rows[0].n, table).toBe(0)
    }
    expect((await as(STRANGER, 'select id from profiles')).rows.length).toBeLessThanOrEqual(1)
    const u = await as(STRANGER, `update transactions set amount = 1 returning id`)
    expect(u.rows.length).toBe(0)
    await rejects(as(STRANGER, `insert into transaction_comments (transaction_id, comment) values ($1, 'hi')`, [TX]))
  })

  it('anon can read nothing at all', async () => {
    await rejects(as(null, 'select * from transactions'))
    await rejects(as(null, 'select * from transaction_comments'))
    await rejects(as(null, 'select * from profiles'))
  })
})

describe('PIN login', () => {
  type Check = { ok: boolean; uid: string | null; retry_after: number; attempts_left: number }
  const check = (person: string, pin: string) =>
    asService<Check>('select * from public.pin_login_check($1, $2)', [person, pin]).then((r) => r.rows[0])

  it('stores only bcrypt hashes', async () => {
    const r = await db.query<{ pin_hash: string }>(`select pin_hash from private.pin_credentials where person = 'jais'`)
    expect(r.rows[0].pin_hash).toMatch(/^\$2[aby]\$10\$/)
    expect(r.rows[0].pin_hash).not.toContain('4821')
  })

  it('accepts the right PIN and returns the person’s user id', async () => {
    expect(await check('jais', '4821')).toMatchObject({ ok: true, uid: JAIS })
    expect(await check('khushi', '1306')).toMatchObject({ ok: true, uid: KHUSHI })
    expect(await check('khushi', '4821')).toMatchObject({ ok: false, uid: null })
  })

  it('locks out after five wrong guesses, then escalates', async () => {
    await db.exec(`select private.unlock_pin('jais')`)
    const left = []
    for (let i = 0; i < 4; i++) left.push((await check('jais', '0000')).attempts_left)
    expect(left).toEqual([4, 3, 2, 1])
    expect(await check('jais', '0000')).toMatchObject({ ok: false, attempts_left: 0, retry_after: 300 })
    // even the right PIN is refused while locked
    expect((await check('jais', '4821')).ok).toBe(false)
    await db.exec(`update private.pin_credentials set locked_until = now() - interval '1 second' where person = 'jais'`)
    expect(await check('jais', '0000')).toMatchObject({ retry_after: 600 })
    await db.exec(`select private.unlock_pin('jais')`)
    expect((await check('jais', '4821')).ok).toBe(true)
  })

  it('rejects malformed input without crashing', async () => {
    expect((await check('jais', "' or 1=1 --")).ok).toBe(false)
    expect((await check('nobody', '1234')).attempts_left).toBe(-1)
    await db.exec(`select private.unlock_pin('jais')`)
  })

  it('is invisible to the browser roles', async () => {
    await rejects(as(JAIS, `select * from public.pin_login_check('jais', '4821')`))
    await rejects(as(null, `select * from public.pin_login_check('jais', '4821')`))
    await rejects(as(JAIS, 'select * from private.pin_credentials'))
    await rejects(as(JAIS, `select private.set_pin('khushi', '0000')`))
  })

  it('lets a signed-in person change their own PIN only with the current one', async () => {
    const wrong = await as<{ change_my_pin: boolean }>(KHUSHI, `select public.change_my_pin('9999', '2468')`)
    expect(wrong.rows[0].change_my_pin).toBe(false)
    const right = await as<{ change_my_pin: boolean }>(KHUSHI, `select public.change_my_pin('1306', '2468')`)
    expect(right.rows[0].change_my_pin).toBe(true)
    expect((await check('khushi', '2468')).ok).toBe(true)
    await expect(as(KHUSHI, `select public.change_my_pin('2468', '12')`)).rejects.toThrow(/exactly 4 digits/)
  })
})

describe('deleting', () => {
  it('a transaction removes its comments and leaves a trail', async () => {
    await as(JAIS, `delete from transactions where id = $1`, [TX])
    expect((await db.query('select 1 from transaction_comments where transaction_id = $1', [TX])).rows.length).toBe(0)
    const log = await db.query<{ actor_id: string }>(
      `select actor_id from activity_log where action = 'transaction_deleted' and entity_id = $1`,
      [TX],
    )
    expect(log.rows[0].actor_id).toBe(JAIS)
  })
})
