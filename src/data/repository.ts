import type {
  Account,
  ActivityEntry,
  Category,
  Member,
  MonthKey,
  MonthSetting,
  Profile,
  Snapshot,
  Transaction,
  TransactionComment,
} from './types'

/** Who is signed in, and whose ledger they're looking at. */
export interface Session {
  viewer: Member
  /** Jais's user id: every money row belongs to his ledger. */
  ownerId: string
}

/**
 * Persistence boundary. The store talks to this and nothing else, so the
 * UI doesn't care whether data lives on the device or in Supabase.
 *
 * New rows and edits are separate calls on purpose: Khushi may edit but
 * never insert, and the database enforces that (an upsert would count as
 * an insert attempt).
 */
export interface Repository {
  readonly mode: 'local' | 'cloud'
  readonly session: Session
  /** null when the ledger hasn't been set up yet. */
  load(): Promise<Snapshot | null>
  insertTransaction(t: Transaction): Promise<void>
  updateTransaction(t: Transaction): Promise<void>
  deleteTransaction(id: string): Promise<void>
  addComment(c: TransactionComment): Promise<void>
  /** The paper trail for one transaction (its edits and comments). */
  activityFor(transactionId: string): Promise<ActivityEntry[]>
  saveAccount(a: Account): Promise<void>
  deleteAccount(id: string): Promise<void>
  saveCategory(c: Category): Promise<void>
  deleteCategory(id: string): Promise<void>
  saveMonthSetting(s: MonthSetting): Promise<void>
  deleteMonthSetting(month: MonthKey): Promise<void>
  /** The owner saves the ledger profile; the observer only her own prefs. */
  saveProfile(p: Profile): Promise<void>
  /** Seed a brand-new ledger (onboarding) or reset the local demo. */
  replaceAll(s: Snapshot): Promise<void>
}

export class RepositoryError extends Error {
  readonly detail?: string
  constructor(message: string, detail?: string) {
    super(message)
    this.name = 'RepositoryError'
    this.detail = detail
  }
}
