import type { Account, Category, MonthKey, MonthSetting, Profile, Snapshot, Transaction } from './types'

/**
 * Persistence boundary. The store talks to this and nothing else, so the
 * UI doesn't care whether data lives on the device or in Supabase.
 * Writes are upserts keyed by client-generated ids, which keeps optimistic
 * updates simple and makes "undo delete" a plain re-insert.
 */
export interface Repository {
  readonly mode: 'local' | 'cloud'
  load(): Promise<Snapshot | null>
  saveTransaction(t: Transaction): Promise<void>
  deleteTransaction(id: string): Promise<void>
  saveAccount(a: Account): Promise<void>
  deleteAccount(id: string): Promise<void>
  saveCategory(c: Category): Promise<void>
  deleteCategory(id: string): Promise<void>
  saveMonthSetting(s: MonthSetting): Promise<void>
  deleteMonthSetting(month: MonthKey): Promise<void>
  saveProfile(p: Profile): Promise<void>
  /** Replace everything (used by onboarding seeds and local resets). */
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
