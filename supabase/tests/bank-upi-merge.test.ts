/**
 * The Bank + UPI merge, run against real Postgres (PGlite) on a ledger that
 * already has money in it: nothing may be lost, nothing may look "edited",
 * and running it again must change nothing.
 */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const MIGRATIONS = join(__dirname, '..', 'migrations')
const MERGE = '20261007000000_bank_upi_one_account.sql'

const JAIS = '11111111-1111-4111-8111-111111111111'
const KHUSHI = '22222222-2222-4222-8222-222222222222'
const HDFC_USER = '33333333-3333-4333-8333-333333333333'
const BANK_ONLY = '44444444-4444-4444-8444-444444444444'

const BANK = 'aaaaaaaa-0000-4000-8000-000000000001'
const UPI = 'aaaaaaaa-0000-4000-8000-000000000002'
const CASH = 'aaaaaaaa-0000-4000-8000-000000000003'
const K_UPI = 'aaaaaaaa-0000-4000-8000-000000000004'
const HDFC = 'aaaaaaaa-0000-4000-8000-000000000005'
const H_UPI = 'aaaaaaaa-0000-4000-8000-000000000006'
const B_BANK = 'aaaaaaaa-0000-4000-8000-000000000007'
const FOOD = 'cccccccc-0000-4000-8000-000000000001'
const FAMILY = 'cccccccc-0000-4000-8000-000000000002'
const H_FOOD = 'cccccccc-0000-4000-8000-000000000003'
const TX_UPI_SPEND = 'dddddddd-0000-4000-8000-000000000001'
const TX_UPI_INCOME = 'dddddddd-0000-4000-8000-000000000002'
const TX_BANK = 'dddddddd-0000-4000-8000-000000000003'
const TX_CASH = 'dddddddd-0000-4000-8000-000000000004'
const TX_HDFC_UPI = 'dddddddd-0000-4000-8000-000000000005'

let db: PGlite
const merge = () => db.exec(readFileSync(join(MIGRATIONS, MERGE), 'utf8'))
const rows = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows

async function as(uid: string, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

/** opening balances + money in − money out, for one ledger */
const ledgerTotal = async (user: string) =>
  Number(
    (
      await rows<{ total: string }>(
        `select (select coalesce(sum(opening_balance), 0) from accounts where user_id = $1)
              + (select coalesce(sum(case when type = 'income' then amount else -amount end), 0) from transactions where user_id = $1)
              + (select coalesce(sum(start_adjustment), 0) from monthly_settings where user_id = $1) as total`,
        [user],
      )
    )[0].total,
  )

const snapshot = async () => ({
  stamps: await rows(`select id, updated_at, updated_by, created_by, created_at from transactions order by id`),
  activity: (await rows<{ n: number }>(`select count(*)::int as n from activity_log`))[0].n,
  comments: await rows(`select transaction_id, comment from transaction_comments order by created_at`),
})

let before: Awaited<ReturnType<typeof snapshot>>
let totalBefore: number

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
  // The database as it was before this migration existed…
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f < MERGE).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'))
  }
  await db.exec(`grant usage on schema extensions to service_role, authenticated;`)
  await db.exec(
    `insert into auth.users values ('${JAIS}', 'jais@x.in'), ('${KHUSHI}', 'khushi@x.in'), ('${HDFC_USER}', 'h@x.in'), ('${BANK_ONLY}', 'b@x.in')`,
  )
  await db.exec(`select private.setup_ledger('jais@x.in', 'khushi@x.in')`)

  // …with a ledger that has been used for a while.
  await as(
    JAIS,
    `insert into accounts (id, user_id, name, kind, opening_balance, sort_order) values
       ($1, $4, 'Bank', 'bank', 5000, 0), ($2, $4, 'UPI', 'upi', 2000.50, 1), ($3, $4, 'Cash', 'cash', 500, 2)`,
    [BANK, UPI, CASH, JAIS],
  )
  await as(
    JAIS,
    `insert into categories (id, user_id, key, name, kind) values ($1, $3, 'food', 'Food', 'expense'), ($2, $3, 'family', 'Family', 'income')`,
    [FOOD, FAMILY, JAIS],
  )
  await as(
    JAIS,
    `insert into transactions (id, user_id, type, amount, category_id, description, account_id, date, time) values
       ($1, $5, 'expense', 320,  $6, 'McDonald''s', $8,  '2026-09-23', '20:42'),
       ($2, $5, 'income',  1500, $7, 'Mom',         $8,  '2026-09-01', '10:00'),
       ($3, $5, 'expense', 400,  $6, 'Myntra',      $9,  '2026-09-06', '17:40'),
       ($4, $5, 'expense', 80,   $6, 'Auto',        $10, '2026-09-15', '19:10')`,
    [TX_UPI_SPEND, TX_UPI_INCOME, TX_BANK, TX_CASH, JAIS, FOOD, FAMILY, UPI, BANK, CASH],
  )
  await as(JAIS, `insert into monthly_settings (user_id, month, start_adjustment, adjustment_account_id) values ($1, '2026-10', 300, $2)`, [JAIS, UPI])
  // Khushi fixed one and left a note on it.
  await as(KHUSHI, `update transactions set description = 'McDonald''s (large fries)' where id = $1`, [TX_UPI_SPEND])
  await as(KHUSHI, `insert into transaction_comments (transaction_id, comment) values ($1, 'large fries were NOT necessary.')`, [TX_UPI_SPEND])

  // Other ledgers: only a UPI account; a renamed bank; a bank and nothing else.
  await db.exec(`
    insert into accounts (id, user_id, name, kind, opening_balance) values ('${K_UPI}', '${KHUSHI}', 'UPI', 'upi', 75);
    insert into accounts (id, user_id, name, kind, opening_balance, archived) values
      ('${HDFC}', '${HDFC_USER}', 'HDFC', 'bank', 100, true), ('${H_UPI}', '${HDFC_USER}', 'GPay', 'upi', 40, false);
    insert into categories (id, user_id, key, name, kind) values ('${H_FOOD}', '${HDFC_USER}', 'food', 'Food', 'expense');
    insert into transactions (id, user_id, type, amount, category_id, description, account_id, date, time)
      values ('${TX_HDFC_UPI}', '${HDFC_USER}', 'expense', 10, '${H_FOOD}', 'Chai', '${H_UPI}', '2026-09-02', '09:00');
    insert into accounts (id, user_id, name, kind, opening_balance) values ('${B_BANK}', '${BANK_ONLY}', 'Bank', 'bank', 900);
  `)

  before = await snapshot()
  totalBefore = await ledgerTotal(JAIS)
  await merge()
})

describe('Bank + UPI merge', () => {
  it('leaves one "Bank / UPI" account holding both opening balances', async () => {
    const accounts = await rows(`select id, name, kind, opening_balance::float as opening from accounts where user_id = $1 order by sort_order`, [JAIS])
    expect(accounts).toEqual([
      { id: BANK, name: 'Bank / UPI', kind: 'bank', opening: 7000.5 },
      { id: CASH, name: 'Cash', kind: 'cash', opening: 500 },
    ])
    expect(await rows(`select 1 from accounts where kind = 'upi'`)).toEqual([])
  })

  it('moves the UPI transactions and month adjustment to it, and loses none', async () => {
    const txs = await rows(`select id, account_id, amount::float as amount from transactions where user_id = $1 order by id`, [JAIS])
    expect(txs).toEqual([
      { id: TX_UPI_SPEND, account_id: BANK, amount: 320 },
      { id: TX_UPI_INCOME, account_id: BANK, amount: 1500 },
      { id: TX_BANK, account_id: BANK, amount: 400 },
      { id: TX_CASH, account_id: CASH, amount: 80 },
    ])
    expect(await rows(`select adjustment_account_id from monthly_settings where user_id = $1`, [JAIS])).toEqual([{ adjustment_account_id: BANK }])
  })

  it('does not change how much money there is', async () => {
    expect(totalBefore).toBe(5000 + 2000.5 + 500 + 1500 - 320 - 400 - 80 + 300)
    expect(await ledgerTotal(JAIS)).toBe(totalBefore)
  })

  it('does not make anything look edited: timestamps, editors, paper trail and notes are untouched', async () => {
    expect(await snapshot()).toEqual(before)
    const edited = await rows(`select updated_by from transactions where id = $1`, [TX_UPI_SPEND])
    expect(edited).toEqual([{ updated_by: KHUSHI }])
  })

  it('turns the transaction triggers back on', async () => {
    await as(JAIS, `update transactions set description = 'Auto (late)' where id = $1`, [TX_CASH])
    const after = await snapshot()
    expect(after.activity).toBe(before.activity + 1)
    const tx = (await rows<{ touched: boolean }>(`select updated_at > created_at as touched from transactions where id = $1`, [TX_CASH]))[0]
    expect(tx.touched).toBe(true)
  })

  it('turns a lone UPI account into the bank account', async () => {
    expect(await rows(`select id, name, kind, opening_balance::float as opening from accounts where user_id = $1`, [KHUSHI])).toEqual([
      { id: K_UPI, name: 'Bank / UPI', kind: 'bank', opening: 75 },
    ])
  })

  it('keeps a renamed bank’s name, and un-archives it if the UPI account was in use', async () => {
    expect(await rows(`select id, name, kind, opening_balance::float as opening, archived from accounts where user_id = $1`, [HDFC_USER])).toEqual([
      { id: HDFC, name: 'HDFC', kind: 'bank', opening: 140, archived: false },
    ])
    expect(await rows(`select account_id from transactions where id = $1`, [TX_HDFC_UPI])).toEqual([{ account_id: HDFC }])
  })

  it('leaves a ledger without a UPI account alone', async () => {
    expect(await rows(`select name, opening_balance::float as opening from accounts where user_id = $1`, [BANK_ONLY])).toEqual([{ name: 'Bank', opening: 900 }])
  })

  it('keeps a private backup that the app cannot read', async () => {
    const kinds = await rows<{ what: string; n: number }>(`select what, count(*)::int as n from private.bank_upi_merge_backup group by what order by what`)
    // 3 UPI accounts + the 2 banks they were folded into; 3 moved transactions; 1 month adjustment
    expect(kinds).toEqual([
      { what: 'account', n: 5 },
      { what: 'month', n: 1 },
      { what: 'transaction', n: 3 },
    ])
    await expect(as(JAIS, `select * from private.bank_upi_merge_backup`)).rejects.toThrow(/permission denied/)
  })

  it('changes nothing when run again', async () => {
    const state = async () => ({
      accounts: await rows(`select id, name, kind, opening_balance, archived, updated_at from accounts order by id`),
      txs: await rows(`select id, account_id, updated_at from transactions order by id`),
      backup: (await rows<{ n: number }>(`select count(*)::int as n from private.bank_upi_merge_backup`))[0].n,
    })
    const first = await state()
    await merge()
    expect(await state()).toEqual(first)
  })
})
