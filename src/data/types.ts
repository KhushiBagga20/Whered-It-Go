/** 'YYYY-MM' */
export type MonthKey = string
/** 'YYYY-MM-DD' (local calendar date, no timezone) */
export type DateKey = string
/** 'HH:MM' 24h */
export type TimeKey = string

export type TxType = 'expense' | 'income'

/** The two people who use the app. */
export type Person = 'jais' | 'khushi'
/** Jais owns the ledger; Khushi observes it (and occasionally interferes). */
export type Role = 'owner' | 'observer'

export interface Member {
  id: string
  person: Person | null
  name: string
  role: Role
}

export interface Transaction {
  id: string
  type: TxType
  /** Rupees. Always positive; `type` carries the direction. */
  amount: number
  categoryId: string
  description: string
  accountId: string
  date: DateKey
  time: TimeKey
  note: string | null
  createdAt: string
  updatedAt: string
  /** Who added it / last changed it (set by the database, not the client). */
  createdBy: string | null
  updatedBy: string | null
}

/** A permanent note Khushi pinned to a transaction. */
export interface TransactionComment {
  id: string
  transactionId: string
  authorId: string
  comment: string
  createdAt: string
}

export type ActivityAction =
  | 'transaction_created'
  | 'transaction_updated'
  | 'transaction_deleted'
  | 'comment_added'
  | 'account_created'
  | 'category_created'

export interface ActivityEntry {
  id: string
  actorId: string | null
  action: ActivityAction
  entityType: 'transaction' | 'comment' | 'account' | 'category'
  entityId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type AccountKind = 'bank' | 'upi' | 'cash' | 'card' | 'wallet' | 'other'

export interface Account {
  id: string
  name: string
  kind: AccountKind
  /** What this account held when tracking started (start of Profile.startMonth). */
  openingBalance: number
  /** Index into the category/world palette (0-9). */
  color: number
  sortOrder: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  /** Stable key for built-in categories ('food', 'shopping'…); null for custom ones. */
  key: string | null
  name: string
  kind: TxType
  icon: string
  /** Palette slot 0-9 (0 is the neutral "other" slot). */
  color: number
  sortOrder: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Per-month tweak to the rolled-over starting balance. The difference is
 * booked against one account so account balances and the dashboard agree.
 */
export interface MonthSetting {
  month: MonthKey
  startAdjustment: number
  adjustmentAccountId: string | null
  updatedAt: string
}

export type MotionLevel = 'full' | 'calm' | 'minimal'
export type Judginess = 'chill' | 'normal' | 'strict'

export interface Prefs {
  motion: MotionLevel
  mascotVisible: boolean
  reactions: boolean
  judginess: Judginess
  weekStartsOn: 0 | 1
}

export interface Profile {
  displayName: string
  mascotName: string
  /** First tracked month; opening balances are as of its first day. */
  startMonth: MonthKey
  /**
   * The day logging actually began (onboarding day). Days before it aren't
   * counted as "no-spend" — nobody was writing anything down yet.
   */
  trackingSince?: DateKey | null
  onboarded: boolean
  prefs: Prefs
}

export interface Snapshot {
  transactions: Transaction[]
  accounts: Account[]
  categories: Category[]
  monthSettings: MonthSetting[]
  /** The ledger's profile (Jais's), with the viewer's own prefs. */
  profile: Profile
  comments: TransactionComment[]
  members: Member[]
}

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> & {
  id?: string
}
