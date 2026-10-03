import { currentMonthKey } from '../lib/dates'
import { newId, nowIso } from '../lib/id'
import type { Account, AccountKind, Category, Prefs, Profile, TxType } from './types'

interface CategorySeed {
  key: string
  name: string
  icon: string
  color: number
}

/*
 * Built-in categories. `color` is a palette slot (see --cat-N in tokens.css);
 * the slot order is what keeps neighbouring donut slices distinguishable,
 * so the chart draws slices in slot order, not in this list's order.
 */
export const DEFAULT_EXPENSE_CATEGORIES: CategorySeed[] = [
  { key: 'food', name: 'Food', icon: 'utensils', color: 1 },
  { key: 'transport', name: 'Transport', icon: 'bus', color: 8 },
  { key: 'shopping', name: 'Shopping', icon: 'shopping-bag', color: 2 },
  { key: 'entertainment', name: 'Entertainment', icon: 'popcorn', color: 3 },
  { key: 'college', name: 'College', icon: 'graduation-cap', color: 5 },
  { key: 'health', name: 'Health', icon: 'heart-pulse', color: 9 },
  { key: 'subscriptions', name: 'Subscriptions', icon: 'repeat', color: 4 },
  { key: 'gifts', name: 'Gifts', icon: 'gift', color: 7 },
  { key: 'personal', name: 'Personal', icon: 'sparkles', color: 6 },
  { key: 'other', name: 'Other', icon: 'shapes', color: 0 },
]

export const DEFAULT_INCOME_CATEGORIES: CategorySeed[] = [
  { key: 'family', name: 'Family', icon: 'hand-coins', color: 3 },
  { key: 'work', name: 'Work', icon: 'briefcase', color: 5 },
  { key: 'gift-in', name: 'Gift', icon: 'gift', color: 2 },
  { key: 'refund', name: 'Refund', icon: 'undo', color: 8 },
  { key: 'other-in', name: 'Other', icon: 'shapes', color: 0 },
]

export function buildDefaultCategories(): Category[] {
  const ts = nowIso()
  const make = (seeds: CategorySeed[], kind: TxType) =>
    seeds.map<Category>((s, i) => ({
      id: newId(),
      key: s.key,
      name: s.name,
      kind,
      icon: s.icon,
      color: s.color,
      sortOrder: i,
      archived: false,
      createdAt: ts,
      updatedAt: ts,
    }))
  return [...make(DEFAULT_EXPENSE_CATEGORIES, 'expense'), ...make(DEFAULT_INCOME_CATEGORIES, 'income')]
}

export const ACCOUNT_KINDS: { kind: AccountKind; label: string; icon: string; color: number }[] = [
  { kind: 'bank', label: 'Bank', icon: 'landmark', color: 8 },
  { kind: 'upi', label: 'UPI', icon: 'smartphone', color: 5 },
  { kind: 'cash', label: 'Cash', icon: 'banknote', color: 3 },
  { kind: 'card', label: 'Card', icon: 'credit-card', color: 2 },
  { kind: 'wallet', label: 'Wallet', icon: 'wallet', color: 1 },
  { kind: 'other', label: 'Other', icon: 'piggy-bank', color: 6 },
]

export function accountKindMeta(kind: AccountKind) {
  return ACCOUNT_KINDS.find((k) => k.kind === kind) ?? ACCOUNT_KINDS[ACCOUNT_KINDS.length - 1]
}

export function buildAccount(name: string, kind: AccountKind, openingBalance: number, sortOrder: number): Account {
  const ts = nowIso()
  return {
    id: newId(),
    name,
    kind,
    openingBalance,
    color: accountKindMeta(kind).color,
    sortOrder,
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  }
}

export function buildDefaultAccounts(balances: { bank: number; upi: number; cash: number }): Account[] {
  return [
    buildAccount('Bank', 'bank', balances.bank, 0),
    buildAccount('UPI', 'upi', balances.upi, 1),
    buildAccount('Cash', 'cash', balances.cash, 2),
  ]
}

export const DEFAULT_PREFS: Prefs = {
  motion: 'full',
  mascotVisible: true,
  reactions: true,
  judginess: 'normal',
  weekStartsOn: 1,
}

export function buildDefaultProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    displayName: '',
    mascotName: 'Khushi',
    startMonth: currentMonthKey(),
    trackingSince: null,
    onboarded: false,
    prefs: DEFAULT_PREFS,
    ...overrides,
  }
}

/** Merge stored prefs over defaults so new settings get sane values (and retired ones drop out). */
export function withPrefDefaults(prefs: Partial<Prefs> | undefined): Prefs {
  const merged = { ...DEFAULT_PREFS, ...prefs } as Prefs & { notifications?: unknown }
  delete merged.notifications
  return merged
}
