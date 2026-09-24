/** 'YYYY-MM' */
export type MonthKey = string
/** 'YYYY-MM-DD' (local calendar date, no timezone) */
export type DateKey = string
/** 'HH:MM' 24h */
export type TimeKey = string

export type TxType = 'expense' | 'income'

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

export interface NotificationPrefs {
  enabled: boolean
  eveningNudge: boolean
  nudgeTime: TimeKey
  bigDayAlert: boolean
  bigDayThreshold: number
  celebrateSaving: boolean
}

export interface Prefs {
  motion: MotionLevel
  mascotVisible: boolean
  reactions: boolean
  judginess: Judginess
  weekStartsOn: 0 | 1
  notifications: NotificationPrefs
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
  profile: Profile
}

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
