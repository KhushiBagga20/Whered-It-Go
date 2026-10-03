import { withPrefDefaults } from './defaults'
import { RepositoryError, type Repository, type Session } from './repository'
import type { ActivityAction, ActivityEntry, Member, Person, Snapshot, Transaction } from './types'
import { newId, nowIso } from '../lib/id'

const KEY = 'wig:local:v1'
const META_KEY = 'wig:local:meta'
const ACTIVITY_KEY = 'wig:local:activity'
const VIEWER_KEY = 'wig:local:viewer'

/** On-device mode has the same two people as the real app, with fixed ids. */
export const LOCAL_MEMBERS: Member[] = [
  { id: 'local-jais', person: 'jais', name: 'Jais', role: 'owner' },
  { id: 'local-khushi', person: 'khushi', name: 'Khushi', role: 'observer' },
]
export const LOCAL_OWNER_ID = LOCAL_MEMBERS[0].id

export interface LocalMeta {
  /** True while the device is showing the bundled demo, not real data. */
  demo: boolean
}

function read(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Snapshot
    parsed.profile.prefs = withPrefDefaults(parsed.profile.prefs)
    // data saved before comments/people existed
    parsed.comments ??= []
    parsed.members = LOCAL_MEMBERS
    parsed.transactions = parsed.transactions.map((t) => ({
      ...t,
      createdBy: t.createdBy ?? LOCAL_OWNER_ID,
      updatedBy: t.updatedBy ?? t.createdBy ?? LOCAL_OWNER_ID,
    }))
    return parsed
  } catch {
    return null
  }
}

export function readLocalMeta(): LocalMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as LocalMeta) : { demo: false }
  } catch {
    return { demo: false }
  }
}

export function writeLocalMeta(meta: LocalMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // storage full/blocked: meta is cosmetic, ignore
  }
}

/** Which of the two people is using this device (on-device mode only). */
export function readLocalViewer(): Person | null {
  try {
    const v = localStorage.getItem(VIEWER_KEY)
    return v === 'jais' || v === 'khushi' ? v : null
  } catch {
    return null
  }
}

export function writeLocalViewer(person: Person | null) {
  try {
    if (person) localStorage.setItem(VIEWER_KEY, person)
    else localStorage.removeItem(VIEWER_KEY)
  } catch {
    // ignore
  }
}

/**
 * On-device repository. Keeps one snapshot in memory and writes it back to
 * localStorage after every change. It mirrors the server's rules (Khushi
 * can't add or delete transactions) so the demo behaves like the real app.
 */
export class LocalRepository implements Repository {
  readonly mode = 'local' as const
  readonly session: Session
  private snap: Snapshot | null = read()

  constructor(person: Person) {
    const viewer = LOCAL_MEMBERS.find((m) => m.person === person) ?? LOCAL_MEMBERS[0]
    this.session = { viewer, ownerId: LOCAL_OWNER_ID }
  }

  private get observer() {
    return this.session.viewer.role === 'observer'
  }

  private ownerOnly(what: string) {
    if (this.observer) throw new RepositoryError(`Only Jais can ${what}.`, 'observer role')
  }

  async load() {
    this.snap = read()
    return this.snap ? structuredClone(this.snap) : null
  }

  private commit(mutate: (s: Snapshot) => void) {
    if (!this.snap) throw new RepositoryError('Nothing to save into yet.')
    mutate(this.snap)
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snap))
    } catch (e) {
      throw new RepositoryError('Couldn’t save to this device’s storage.', e instanceof Error ? e.message : String(e))
    }
  }

  private log(action: ActivityAction, entityType: ActivityEntry['entityType'], entityId: string, metadata: Record<string, unknown>) {
    try {
      const list = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? '[]') as ActivityEntry[]
      list.push({ id: newId(), actorId: this.session.viewer.id, action, entityType, entityId, metadata, createdAt: nowIso() })
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(list.slice(-500)))
    } catch {
      // the trail is best-effort on a device
    }
  }

  private upsert<T extends { id: string }>(list: T[], item: T) {
    const i = list.findIndex((x) => x.id === item.id)
    if (i === -1) list.push(item)
    else list[i] = item
  }

  async insertTransaction(t: Transaction) {
    this.ownerOnly('add transactions')
    const row = { ...t, createdBy: this.session.viewer.id, updatedBy: this.session.viewer.id }
    this.commit((s) => this.upsert(s.transactions, row))
    this.log('transaction_created', 'transaction', t.id, { type: t.type, amount: t.amount, description: t.description })
  }

  async updateTransaction(t: Transaction) {
    let changes: Record<string, [unknown, unknown]> = {}
    this.commit((s) => {
      const i = s.transactions.findIndex((x) => x.id === t.id)
      if (i === -1) throw new RepositoryError('That transaction no longer exists.')
      const before = s.transactions[i]
      changes = diffTransaction(before, t)
      s.transactions[i] = { ...t, createdBy: before.createdBy, createdAt: before.createdAt, updatedBy: this.session.viewer.id }
    })
    if (Object.keys(changes).length) this.log('transaction_updated', 'transaction', t.id, { changes })
  }

  async deleteTransaction(id: string) {
    this.ownerOnly('delete transactions')
    let victim: Transaction | undefined
    this.commit((s) => {
      victim = s.transactions.find((t) => t.id === id)
      s.transactions = s.transactions.filter((t) => t.id !== id)
      s.comments = s.comments.filter((c) => c.transactionId !== id)
    })
    if (victim) {
      this.log('transaction_deleted', 'transaction', id, {
        type: victim.type,
        amount: victim.amount,
        description: victim.description,
        date: victim.date,
      })
    }
  }

  async addComment(c: Snapshot['comments'][number]) {
    if (!this.observer) throw new RepositoryError('Only Khushi leaves notes.', 'owner role')
    const row = { ...c, authorId: this.session.viewer.id, comment: c.comment.trim() }
    this.commit((s) => s.comments.push(row))
    this.log('comment_added', 'comment', c.id, { transaction_id: c.transactionId, preview: row.comment.slice(0, 80) })
  }

  async activityFor(transactionId: string) {
    try {
      const list = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? '[]') as ActivityEntry[]
      return list.filter((e) => e.entityId === transactionId || e.metadata.transaction_id === transactionId)
    } catch {
      return []
    }
  }

  async saveAccount(a: Snapshot['accounts'][number]) {
    this.ownerOnly('manage accounts')
    const isNew = !this.snap?.accounts.some((x) => x.id === a.id)
    this.commit((s) => this.upsert(s.accounts, a))
    if (isNew) this.log('account_created', 'account', a.id, { name: a.name })
  }
  async deleteAccount(id: string) {
    this.ownerOnly('manage accounts')
    this.commit((s) => {
      s.accounts = s.accounts.filter((a) => a.id !== id)
    })
  }
  async saveCategory(c: Snapshot['categories'][number]) {
    this.ownerOnly('manage categories')
    const isNew = !this.snap?.categories.some((x) => x.id === c.id)
    this.commit((s) => this.upsert(s.categories, c))
    if (isNew) this.log('category_created', 'category', c.id, { name: c.name })
  }
  async deleteCategory(id: string) {
    this.ownerOnly('manage categories')
    this.commit((s) => {
      s.categories = s.categories.filter((c) => c.id !== id)
    })
  }
  async saveMonthSetting(m: Snapshot['monthSettings'][number]) {
    this.ownerOnly('change starting balances')
    this.commit((s) => {
      const i = s.monthSettings.findIndex((x) => x.month === m.month)
      if (i === -1) s.monthSettings.push(m)
      else s.monthSettings[i] = m
    })
  }
  async deleteMonthSetting(month: string) {
    this.ownerOnly('change starting balances')
    this.commit((s) => {
      s.monthSettings = s.monthSettings.filter((m) => m.month !== month)
    })
  }
  async saveProfile(p: Snapshot['profile']) {
    // On a device both people share prefs; only Jais changes the ledger itself.
    this.commit((s) => {
      s.profile = this.observer ? { ...s.profile, prefs: p.prefs } : p
    })
  }
  async replaceAll(next: Snapshot) {
    this.snap = structuredClone({ ...next, members: LOCAL_MEMBERS })
    this.commit(() => {})
  }

  /** Wipe everything on this device (Settings → reset). */
  static clear() {
    localStorage.removeItem(KEY)
    localStorage.removeItem(META_KEY)
    localStorage.removeItem(ACTIVITY_KEY)
  }
}

const TRACKED: (keyof Transaction)[] = ['type', 'amount', 'categoryId', 'accountId', 'description', 'date', 'time', 'note']
const DB_NAMES: Partial<Record<keyof Transaction, string>> = { categoryId: 'category_id', accountId: 'account_id' }

/** Same shape the database trigger writes: { field: [before, after] }. */
export function diffTransaction(before: Transaction, after: Transaction): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {}
  for (const key of TRACKED) {
    if (before[key] !== after[key]) out[DB_NAMES[key] ?? key] = [before[key], after[key]]
  }
  return out
}
