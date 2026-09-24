import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { withPrefDefaults } from './defaults'
import { RepositoryError, type Repository } from './repository'
import type { Account, Category, MonthSetting, Profile, Snapshot, Transaction } from './types'

// ── Row shapes (snake_case, as stored) ──────────────────────────────────

interface TransactionRow {
  id: string
  user_id: string
  type: Transaction['type']
  amount: number | string
  category_id: string
  description: string
  account_id: string
  date: string
  time: string
  note: string | null
  created_at: string
  updated_at: string
}
interface AccountRow {
  id: string
  user_id: string
  name: string
  kind: Account['kind']
  opening_balance: number | string
  color: number
  sort_order: number
  archived: boolean
  created_at: string
  updated_at: string
}
interface CategoryRow {
  id: string
  user_id: string
  key: string | null
  name: string
  kind: Category['kind']
  icon: string
  color: number
  sort_order: number
  archived: boolean
  created_at: string
  updated_at: string
}
interface MonthRow {
  user_id: string
  month: string
  start_adjustment: number | string
  adjustment_account_id: string | null
  updated_at: string
}
interface ProfileRow {
  id: string
  display_name: string
  mascot_name: string
  start_month: string
  tracking_since: string | null
  onboarded: boolean
  prefs: Partial<Profile['prefs']> | null
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v))

const txFromRow = (r: TransactionRow): Transaction => ({
  id: r.id,
  type: r.type,
  amount: num(r.amount),
  categoryId: r.category_id,
  description: r.description,
  accountId: r.account_id,
  date: r.date,
  time: r.time.slice(0, 5),
  note: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
const accountFromRow = (r: AccountRow): Account => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  openingBalance: num(r.opening_balance),
  color: r.color,
  sortOrder: r.sort_order,
  archived: r.archived,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
const categoryFromRow = (r: CategoryRow): Category => ({
  id: r.id,
  key: r.key,
  name: r.name,
  kind: r.kind,
  icon: r.icon,
  color: r.color,
  sortOrder: r.sort_order,
  archived: r.archived,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
const monthFromRow = (r: MonthRow): MonthSetting => ({
  month: r.month,
  startAdjustment: num(r.start_adjustment),
  adjustmentAccountId: r.adjustment_account_id,
  updatedAt: r.updated_at,
})

function fail(action: string, error: PostgrestError | Error | null): never {
  const detail = error ? ('code' in error && error.code ? `${error.code}: ${error.message}` : error.message) : undefined
  throw new RepositoryError(`Couldn’t ${action}.`, detail)
}

/**
 * Supabase-backed repository. Row Level Security scopes every query to the
 * signed-in user; we still send user_id explicitly so inserts are obvious.
 */
export class SupabaseRepository implements Repository {
  readonly mode = 'cloud' as const
  private readonly sb: SupabaseClient
  private readonly userId: string

  constructor(sb: SupabaseClient, userId: string) {
    this.sb = sb
    this.userId = userId
  }

  /** PostgREST caps responses (1000 rows by default), so page through. */
  private async all<T>(table: string, order: string): Promise<T[]> {
    const page = 1000
    const rows: T[] = []
    for (let from = 0; ; from += page) {
      const { data, error } = await this.sb
        .from(table)
        .select('*')
        .order(order, { ascending: true })
        .range(from, from + page - 1)
      if (error) fail(`load ${table}`, error)
      rows.push(...((data ?? []) as T[]))
      if (!data || data.length < page) break
    }
    return rows
  }

  async load(): Promise<Snapshot | null> {
    const [profileRes, accounts, categories, transactions, months] = await Promise.all([
      this.sb.from('profiles').select('*').eq('id', this.userId).maybeSingle(),
      this.all<AccountRow>('accounts', 'sort_order'),
      this.all<CategoryRow>('categories', 'sort_order'),
      this.all<TransactionRow>('transactions', 'created_at'),
      this.all<MonthRow>('monthly_settings', 'month'),
    ])
    if (profileRes.error) fail('load your profile', profileRes.error)
    const p = profileRes.data as ProfileRow | null
    if (!p) return null
    return {
      profile: {
        displayName: p.display_name,
        mascotName: p.mascot_name,
        startMonth: p.start_month,
        trackingSince: p.tracking_since,
        onboarded: p.onboarded,
        prefs: withPrefDefaults(p.prefs ?? undefined),
      },
      accounts: accounts.map(accountFromRow),
      categories: categories.map(categoryFromRow),
      transactions: transactions.map(txFromRow),
      monthSettings: months.map(monthFromRow),
    }
  }

  private txRow(t: Transaction): TransactionRow {
    return {
      id: t.id,
      user_id: this.userId,
      type: t.type,
      amount: t.amount,
      category_id: t.categoryId,
      description: t.description,
      account_id: t.accountId,
      date: t.date,
      time: t.time,
      note: t.note,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    }
  }
  private accountRow(a: Account): AccountRow {
    return {
      id: a.id,
      user_id: this.userId,
      name: a.name,
      kind: a.kind,
      opening_balance: a.openingBalance,
      color: a.color,
      sort_order: a.sortOrder,
      archived: a.archived,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    }
  }
  private categoryRow(c: Category): CategoryRow {
    return {
      id: c.id,
      user_id: this.userId,
      key: c.key,
      name: c.name,
      kind: c.kind,
      icon: c.icon,
      color: c.color,
      sort_order: c.sortOrder,
      archived: c.archived,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    }
  }
  private profileRow(p: Profile): ProfileRow {
    return {
      id: this.userId,
      display_name: p.displayName,
      mascot_name: p.mascotName,
      start_month: p.startMonth,
      tracking_since: p.trackingSince ?? null,
      onboarded: p.onboarded,
      prefs: p.prefs,
    }
  }

  async saveTransaction(t: Transaction) {
    const { error } = await this.sb.from('transactions').upsert(this.txRow(t))
    if (error) fail('save that', error)
  }
  async deleteTransaction(id: string) {
    const { error } = await this.sb.from('transactions').delete().eq('id', id)
    if (error) fail('delete that', error)
  }
  async saveAccount(a: Account) {
    const { error } = await this.sb.from('accounts').upsert(this.accountRow(a))
    if (error) fail('save the account', error)
  }
  async deleteAccount(id: string) {
    const { error } = await this.sb.from('accounts').delete().eq('id', id)
    if (error) fail('delete the account', error)
  }
  async saveCategory(c: Category) {
    const { error } = await this.sb.from('categories').upsert(this.categoryRow(c))
    if (error) fail('save the category', error)
  }
  async deleteCategory(id: string) {
    const { error } = await this.sb.from('categories').delete().eq('id', id)
    if (error) fail('delete the category', error)
  }
  async saveMonthSetting(m: MonthSetting) {
    const { error } = await this.sb.from('monthly_settings').upsert({
      user_id: this.userId,
      month: m.month,
      start_adjustment: m.startAdjustment,
      adjustment_account_id: m.adjustmentAccountId,
    })
    if (error) fail('save the starting balance', error)
  }
  async deleteMonthSetting(month: string) {
    const { error } = await this.sb.from('monthly_settings').delete().eq('month', month).eq('user_id', this.userId)
    if (error) fail('reset the starting balance', error)
  }
  async saveProfile(p: Profile) {
    const { error } = await this.sb.from('profiles').upsert(this.profileRow(p))
    if (error) fail('save your settings', error)
  }

  /**
   * Onboarding seed. Order matters for the foreign keys: profile, accounts,
   * categories, then transactions/month settings.
   */
  async replaceAll(s: Snapshot) {
    await this.saveProfile(s.profile)
    if (s.accounts.length) {
      const { error } = await this.sb.from('accounts').upsert(s.accounts.map((a) => this.accountRow(a)))
      if (error) fail('create your accounts', error)
    }
    if (s.categories.length) {
      const { error } = await this.sb.from('categories').upsert(s.categories.map((c) => this.categoryRow(c)))
      if (error) fail('create your categories', error)
    }
    if (s.transactions.length) {
      const { error } = await this.sb.from('transactions').upsert(s.transactions.map((t) => this.txRow(t)))
      if (error) fail('save transactions', error)
    }
    for (const m of s.monthSettings) await this.saveMonthSetting(m)
  }
}
