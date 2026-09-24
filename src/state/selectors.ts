import { useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Account, Category, DateKey, MonthKey, TxType } from '../data/types'
import { addMonths, todayKey } from '../lib/dates'
import {
  calculateAccountBalances,
  calculateCategorySpending,
  calculateDailySpending,
  calculateMonthInsights,
  calculateNoSpendStreak,
  earliestMonth,
  trackingStartDate,
  summarizeMonth,
  transactionsInMonth,
  type Ledger,
} from '../lib/finance'
import { useData } from './store'
import { useUi } from './ui'

/**
 * Derived-data hooks. Components never do arithmetic themselves; they ask
 * for a summary here, which asks lib/finance. Everything is memoised on
 * the raw arrays, so an edit anywhere recomputes everything that depends
 * on it — and nothing else.
 */

// A single ticking clock so "today" rolls over at midnight without reload.
export const useClock = create<{ today: DateKey }>(() => ({ today: todayKey() }))
let clockStarted = false
export function startClock() {
  if (clockStarted) return
  clockStarted = true
  window.setInterval(() => {
    const today = todayKey()
    if (useClock.getState().today !== today) useClock.setState({ today })
  }, 30_000)
}
export const useToday = () => useClock((s) => s.today)

export function useLedger(): Ledger {
  return useData(
    useShallow((s) => ({ transactions: s.transactions, accounts: s.accounts, monthSettings: s.monthSettings })),
  )
}

export const useMonth = () => useUi((s) => s.month)

export function useMonthSummary(month: MonthKey) {
  const ledger = useLedger()
  return useMemo(() => summarizeMonth(ledger, month), [ledger, month])
}

export function useMonthTransactions(month: MonthKey) {
  const txns = useData((s) => s.transactions)
  return useMemo(() => transactionsInMonth(txns, month), [txns, month])
}

export function useCategorySlices(month: MonthKey, type: TxType = 'expense') {
  const txns = useData((s) => s.transactions)
  const categories = useData((s) => s.categories)
  return useMemo(() => calculateCategorySpending(txns, month, categories, type), [txns, month, categories, type])
}

export function useDaily(month: MonthKey) {
  const txns = useData((s) => s.transactions)
  return useMemo(() => calculateDailySpending(txns, month), [txns, month])
}

export function useAccountPositions(month: MonthKey) {
  const ledger = useLedger()
  return useMemo(() => calculateAccountBalances(ledger, month), [ledger, month])
}

/** The first day that counts (see trackingStartDate). */
export function useTrackingStart(): DateKey {
  const txns = useData((s) => s.transactions)
  const startMonth = useData((s) => s.profile.startMonth)
  const trackingSince = useData((s) => s.profile.trackingSince)
  return useMemo(() => trackingStartDate(txns, { startMonth, trackingSince }), [txns, startMonth, trackingSince])
}

export function useInsights(month: MonthKey) {
  const days = useDaily(month)
  const slices = useCategorySlices(month)
  const today = useToday()
  const since = useTrackingStart()
  return useMemo(() => calculateMonthInsights(days, slices, today, since), [days, slices, today, since])
}

export function useNoSpendStreak() {
  const txns = useData((s) => s.transactions)
  const today = useToday()
  const since = useTrackingStart()
  return useMemo(() => calculateNoSpendStreak(txns, today, since), [txns, today, since])
}

export function useCategoryMap(): Map<string, Category> {
  const categories = useData((s) => s.categories)
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
}

export function useAccountMap(): Map<string, Account> {
  const accounts = useData((s) => s.accounts)
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
}

/** Active (non-archived) categories of a kind, in display order. */
export function useCategories(kind: TxType) {
  const categories = useData((s) => s.categories)
  return useMemo(
    () => categories.filter((c) => c.kind === kind && !c.archived).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, kind],
  )
}

export function useActiveAccounts() {
  const accounts = useData((s) => s.accounts)
  return useMemo(() => accounts.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder), [accounts])
}

/** You can browse from the first tracked month up to one month past today. */
export function useMonthBounds() {
  const txns = useData((s) => s.transactions)
  const startMonth = useData((s) => s.profile.startMonth)
  const today = useToday()
  return useMemo(() => {
    const min = earliestMonth(txns, startMonth)
    let max = addMonths(today.slice(0, 7), 1)
    for (const t of txns) if (t.date.slice(0, 7) > max) max = t.date.slice(0, 7)
    return { min, max }
  }, [txns, startMonth, today])
}

/** Where the month is in its life: 0 = just started … 1 = over. */
export function useMonthProgress(month: MonthKey): number {
  const today = useToday()
  const current = today.slice(0, 7)
  if (month < current) return 1
  if (month > current) return 0
  const day = Number(today.slice(8, 10))
  const [y, m] = month.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  return (day - 0.5) / days
}
