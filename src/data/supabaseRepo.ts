import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { withPrefDefaults } from './defaults'
import { RepositoryError, type Repository, type Session } from './repository'
import type {
  Account,
  ActivityEntry,
  Category,
  Member,
  MonthSetting,
  Person,
  Profile,
  Snapshot,
  Transaction,
  TransactionComment,
} from './types'

// ── Row shapes (snake_case, as stored) ──────────────────────────────────

export interface TransactionRow {
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
  created_by: string | null
  updated_by: string | null
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
  person: Person | null
}
export interface CommentRow {
  id: string
  transaction_id: string
  author_id: string
  comment: string
  created_at: string
}
interface ActivityRow {
  id: string
  actor_id: string | null
  action: ActivityEntry['action']
  entity_type: ActivityEntry['entityType']
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

const num = (v: number | string) => (typeof v === 'number' ? v : Number(v))

export const txFromRow = (r: TransactionRow): Transaction => ({
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
  createdBy: r.created_by,
  updatedBy: r.updated_by,
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
export const commentFromRow = (r: CommentRow): TransactionComment => ({
  id: r.id,
  transactionId: r.transaction_id,
  authorId: r.author_id,
  comment: r.comment,
  createdAt: r.created_at,
})
const activityFromRow = (r: ActivityRow): ActivityEntry => ({
  id: r.id,
  actorId: r.actor_id,
  action: r.action,
  entityType: r.entity_type,
  entityId: r.entity_id,
  metadata: r.metadata ?? {},
  createdAt: r.created_at,
})

function fail(action: string, error: PostgrestError | Error | null): never {
  const code = error && 'code' in error ? error.code : undefined
  const detail = error ? (code ? `${code}: ${error.message}` : error.message) : undefined
  if (code === '42501') throw new RepositoryError(`You’re not allowed to ${action}.`, detail)
  throw new RepositoryError(`Couldn’t ${action}.`, detail)
}

const nameFor = (p: ProfileRow | undefined, fallback: string) => p?.display_name?.trim() || fallback

/**
 * Supabase-backed repository. Row Level Security is the real boundary;
 * this class just asks for the right things. Every money row belongs to
 * the owner's (Jais's) ledger, whoever is signed in.
 */
export class SupabaseRepository implements Repository {
  readonly mode = 'cloud' as const
  readonly session: Session
  private readonly sb: SupabaseClient

  private constructor(sb: SupabaseClient, session: Session) {
    this.sb = sb
    this.session = session
  }

  /** Work out who's signed in and whose ledger they see. */
  static async open(sb: SupabaseClient, userId: string): Promise<SupabaseRepository> {
    const [membership, me] = await Promise.all([
      sb.from('ledger_members').select('owner_id').eq('member_id', userId).maybeSingle(),
      sb.from('profiles').select('display_name, person').eq('id', userId).maybeSingle(),
    ])
    if (membership.error) fail('check who you are', membership.error)
    if (me.error) fail('load your profile', me.error)
    const ownerId = (membership.data as { owner_id: string } | null)?.owner_id ?? userId
    const profile = me.data as Pick<ProfileRow, 'display_name' | 'person'> | null
    const role = ownerId === userId ? 'owner' : 'observer'
    const viewer: Member = {
      id: userId,
      person: profile?.person ?? (role === 'owner' ? 'jais' : 'khushi'),
      name: profile?.display_name?.trim() || (role === 'owner' ? 'Jais' : 'Khushi'),
      role,
    }
    return new SupabaseRepository(sb, { viewer, ownerId })
  }

  private get userId() {
    return this.session.viewer.id
  }
  private get ownerId() {
    return this.session.ownerId
  }

  /** PostgREST caps responses (1000 rows by default), so page through. */
  private async all<T>(table: string, order: string, scopeToLedger = true): Promise<T[]> {
    const page = 1000
    const rows: T[] = []
    for (let from = 0; ; from += page) {
      let q = this.sb.from(table).select('*')
      if (scopeToLedger) q = q.eq('user_id', this.ownerId)
      const { data, error } = await q.order(order, { ascending: true }).range(from, from + page - 1)
      if (error) fail(`load ${table.replace('_', ' ')}`, error)
      rows.push(...((data ?? []) as T[]))
      if (!data || data.length < page) break
    }
    return rows
  }

  async load(): Promise<Snapshot | null> {
    const [profilesRes, accounts, categories, transactions, months, comments] = await Promise.all([
      this.sb.from('profiles').select('*'),
      this.all<AccountRow>('accounts', 'sort_order'),
      this.all<CategoryRow>('categories', 'sort_order'),
      this.all<TransactionRow>('transactions', 'created_at'),
      this.all<MonthRow>('monthly_settings', 'month'),
      this.all<CommentRow>('transaction_comments', 'created_at', false),
    ])
    if (profilesRes.error) fail('load profiles', profilesRes.error)
    const profiles = (profilesRes.data ?? []) as ProfileRow[]
    const owner = profiles.find((p) => p.id === this.ownerId)
    const mine = profiles.find((p) => p.id === this.userId)
    if (!owner) return null

    const members: Member[] = profiles
      .filter((p) => p.id === this.ownerId || p.id === this.userId || p.person)
      .map((p) => ({
        id: p.id,
        person: p.person ?? (p.id === this.ownerId ? 'jais' : 'khushi'),
        name: nameFor(p, p.id === this.ownerId ? 'Jais' : 'Khushi'),
        role: p.id === this.ownerId ? 'owner' : 'observer',
      }))

    return {
      profile: {
        displayName: owner.display_name,
        mascotName: owner.mascot_name,
        startMonth: owner.start_month,
        trackingSince: owner.tracking_since,
        onboarded: owner.onboarded,
        // prefs are personal: Khushi keeps her own motion/mascot settings
        prefs: withPrefDefaults((mine ?? owner).prefs ?? undefined),
      },
      accounts: accounts.map(accountFromRow),
      categories: categories.map(categoryFromRow),
      transactions: transactions.map(txFromRow),
      monthSettings: months.map(monthFromRow),
      comments: comments.map(commentFromRow),
      members,
    }
  }

  private txRow(t: Transaction) {
    return {
      id: t.id,
      user_id: this.ownerId,
      type: t.type,
      amount: t.amount,
      category_id: t.categoryId,
      description: t.description,
      account_id: t.accountId,
      date: t.date,
      time: t.time,
      note: t.note,
      created_at: t.createdAt,
    }
  }
  private accountRow(a: Account): AccountRow {
    return {
      id: a.id,
      user_id: this.ownerId,
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
      user_id: this.ownerId,
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

  async insertTransaction(t: Transaction) {
    const { error } = await this.sb.from('transactions').insert(this.txRow(t))
    if (error) fail('save that', error)
  }
  async updateTransaction(t: Transaction) {
    const row = this.txRow(t)
    const { data, error } = await this.sb
      .from('transactions')
      .update({
        type: row.type,
        amount: row.amount,
        category_id: row.category_id,
        description: row.description,
        account_id: row.account_id,
        date: row.date,
        time: row.time,
        note: row.note,
      })
      .eq('id', t.id)
      .select('id')
    if (error) fail('save that', error)
    if (!data?.length) throw new RepositoryError('That transaction no longer exists (or you can’t change it).')
  }
  async deleteTransaction(id: string) {
    const { data, error } = await this.sb.from('transactions').delete().eq('id', id).select('id')
    if (error) fail('delete that', error)
    if (!data?.length) throw new RepositoryError('Couldn’t delete that.', 'not found or not allowed')
  }
  async addComment(c: TransactionComment) {
    const { error } = await this.sb
      .from('transaction_comments')
      .insert({ id: c.id, transaction_id: c.transactionId, comment: c.comment })
    if (error) fail('leave that note', error)
  }
  async activityFor(transactionId: string) {
    const { data, error } = await this.sb
      .from('activity_log')
      .select('*')
      .or(`entity_id.eq.${transactionId},metadata->>transaction_id.eq.${transactionId}`)
      .order('created_at', { ascending: true })
      .limit(100)
    if (error) fail('load the paper trail', error)
    return ((data ?? []) as ActivityRow[]).map(activityFromRow)
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
      user_id: this.ownerId,
      month: m.month,
      start_adjustment: m.startAdjustment,
      adjustment_account_id: m.adjustmentAccountId,
    })
    if (error) fail('save the starting balance', error)
  }
  async deleteMonthSetting(month: string) {
    const { error } = await this.sb.from('monthly_settings').delete().eq('month', month).eq('user_id', this.ownerId)
    if (error) fail('reset the starting balance', error)
  }
  async saveProfile(p: Profile) {
    // Khushi's row only ever stores her own prefs; the ledger profile is Jais's.
    const patch =
      this.session.viewer.role === 'observer'
        ? { prefs: p.prefs }
        : {
            display_name: p.displayName,
            mascot_name: p.mascotName,
            start_month: p.startMonth,
            tracking_since: p.trackingSince ?? null,
            onboarded: p.onboarded,
            prefs: p.prefs,
          }
    const { data, error } = await this.sb.from('profiles').update(patch).eq('id', this.userId).select('id')
    if (error) fail('save your settings', error)
    if (!data?.length) {
      const { error: insertError } = await this.sb.from('profiles').insert({ id: this.userId, ...patch })
      if (insertError) fail('save your settings', insertError)
    }
  }

  /**
   * Onboarding seed (owner only). Order matters for the foreign keys:
   * profile, accounts, categories, then transactions/month settings.
   */
  async replaceAll(s: Snapshot) {
    if (this.session.viewer.role !== 'owner') throw new RepositoryError('Only Jais can set up the ledger.')
    if (s.accounts.length) {
      const { error } = await this.sb.from('accounts').upsert(s.accounts.map((a) => this.accountRow(a)))
      if (error) fail('create your accounts', error)
    }
    if (s.categories.length) {
      const { error } = await this.sb.from('categories').upsert(s.categories.map((c) => this.categoryRow(c)))
      if (error) fail('create your categories', error)
    }
    for (const t of s.transactions) await this.insertTransaction(t)
    for (const m of s.monthSettings) await this.saveMonthSetting(m)
    await this.saveProfile(s.profile)
  }
}
