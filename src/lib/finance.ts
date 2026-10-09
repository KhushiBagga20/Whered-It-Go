import type {
  Account,
  Category,
  DateKey,
  MonthKey,
  MonthSetting,
  Transaction,
  TxType,
} from '../data/types'
import { addDays, datesInMonth, firstDayOfMonth, lastDayOfMonth, monthOf } from './dates'
import { fromPaise, toPaise } from './money'

/**
 * The financial calculation layer.
 *
 * Transactions are the only source of truth. Nothing in here is stored —
 * every figure the UI shows is derived from (accounts, transactions,
 * monthSettings) on demand. All arithmetic runs in integer paise.
 *
 *   start(M)   = Σ opening balances
 *              + Σ income before M − Σ expenses before M
 *              + Σ start adjustments for months ≤ M
 *   current(M) = start(M) + received(M) − spent(M)
 *
 * Rollover is therefore automatic: start(M+1) = current(M) + adj(M+1).
 */

export interface Ledger {
  transactions: readonly Transaction[]
  accounts: readonly Account[]
  monthSettings: readonly MonthSetting[]
}

const signedPaise = (t: Transaction) => (t.type === 'income' ? toPaise(t.amount) : -toPaise(t.amount))

function sumPaise<T>(items: readonly T[], pick: (item: T) => number): number {
  let total = 0
  for (const item of items) total += pick(item)
  return total
}

export function transactionsInMonth<T extends Transaction>(txns: readonly T[], month: MonthKey): T[] {
  return txns.filter((t) => monthOf(t.date) === month)
}

function totalOfType(txns: readonly Transaction[], month: MonthKey, type: TxType): number {
  return fromPaise(
    sumPaise(txns, (t) => (t.type === type && monthOf(t.date) === month ? toPaise(t.amount) : 0)),
  )
}

export function calculateMonthlySpending(txns: readonly Transaction[], month: MonthKey): number {
  return totalOfType(txns, month, 'expense')
}

export function calculateMonthlyIncome(txns: readonly Transaction[], month: MonthKey): number {
  return totalOfType(txns, month, 'income')
}

export function monthAdjustment(settings: readonly MonthSetting[], month: MonthKey): number {
  return settings.find((s) => s.month === month)?.startAdjustment ?? 0
}

export function calculateStartingBalance(ledger: Ledger, month: MonthKey): number {
  const opening = sumPaise(ledger.accounts, (a) => toPaise(a.openingBalance))
  const monthStart = firstDayOfMonth(month)
  const before = sumPaise(ledger.transactions, (t) => (t.date < monthStart ? signedPaise(t) : 0))
  const adjustments = sumPaise(ledger.monthSettings, (s) => (s.month <= month ? toPaise(s.startAdjustment) : 0))
  return fromPaise(opening + before + adjustments)
}

/** Balance at the end of `month` (for the current month: everything logged so far). */
export function calculateCurrentBalance(ledger: Ledger, month: MonthKey): number {
  const start = toPaise(calculateStartingBalance(ledger, month))
  const net = sumPaise(ledger.transactions, (t) => (monthOf(t.date) === month ? signedPaise(t) : 0))
  return fromPaise(start + net)
}

export interface MonthSummary {
  month: MonthKey
  starting: number
  /** Manual tweak included in `starting` (0 when the month simply rolled over). */
  adjustment: number
  /** What `starting` would be without this month's adjustment. */
  rolledOver: number
  received: number
  spent: number
  current: number
  count: number
}

export function summarizeMonth(ledger: Ledger, month: MonthKey): MonthSummary {
  const starting = calculateStartingBalance(ledger, month)
  const adjustment = monthAdjustment(ledger.monthSettings, month)
  const received = calculateMonthlyIncome(ledger.transactions, month)
  const spent = calculateMonthlySpending(ledger.transactions, month)
  return {
    month,
    starting,
    adjustment,
    rolledOver: fromPaise(toPaise(starting) - toPaise(adjustment)),
    received,
    spent,
    current: fromPaise(toPaise(starting) + toPaise(received) - toPaise(spent)),
    count: transactionsInMonth(ledger.transactions, month).length,
  }
}

// ── Categories ────────────────────────────────────────────────────────

export interface MerchantTotal {
  label: string
  total: number
  count: number
}

export interface CategorySlice {
  category: Category
  total: number
  count: number
  /** 0–1 share of the month's total for this type. */
  share: number
  /** Grouped by description, biggest first. */
  merchants: MerchantTotal[]
  transactions: Transaction[]
}

const normalizeLabel = (s: string) => s.trim().replace(/\s+/g, ' ')

export function groupByMerchant(txns: readonly Transaction[]): MerchantTotal[] {
  const map = new Map<string, { label: string; paise: number; count: number }>()
  for (const t of txns) {
    const label = normalizeLabel(t.description) || 'No description'
    const key = label.toLowerCase()
    const entry = map.get(key) ?? { label, paise: 0, count: 0 }
    entry.paise += toPaise(t.amount)
    entry.count += 1
    map.set(key, entry)
  }
  return [...map.values()]
    .map((m) => ({ label: m.label, total: fromPaise(m.paise), count: m.count }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
}

/**
 * Spending (or income) per category for a month, biggest first. Categories
 * that no longer exist fall back to a synthetic "Unknown" slice rather than
 * silently dropping money.
 */
export function calculateCategorySpending(
  txns: readonly Transaction[],
  month: MonthKey,
  categories: readonly Category[],
  type: TxType = 'expense',
): CategorySlice[] {
  const inMonth = txns.filter((t) => t.type === type && monthOf(t.date) === month)
  const totalPaise = sumPaise(inMonth, (t) => toPaise(t.amount))
  const byCat = new Map<string, Transaction[]>()
  for (const t of inMonth) {
    const list = byCat.get(t.categoryId) ?? []
    list.push(t)
    byCat.set(t.categoryId, list)
  }
  const slices: CategorySlice[] = []
  for (const [categoryId, list] of byCat) {
    const category = categories.find((c) => c.id === categoryId) ?? unknownCategory(categoryId, type)
    const paise = sumPaise(list, (t) => toPaise(t.amount))
    slices.push({
      category,
      total: fromPaise(paise),
      count: list.length,
      share: totalPaise === 0 ? 0 : paise / totalPaise,
      merchants: groupByMerchant(list),
      transactions: [...list].sort(compareTransactionsDesc),
    })
  }
  return slices.sort((a, b) => b.total - a.total || a.category.sortOrder - b.category.sortOrder)
}

export function unknownCategory(id: string, kind: TxType): Category {
  return {
    id,
    key: null,
    name: 'Unknown',
    kind,
    icon: 'circle-help',
    color: 0,
    sortOrder: 999,
    archived: true,
    createdAt: '',
    updatedAt: '',
  }
}

// ── Days ──────────────────────────────────────────────────────────────

export interface DayActivity {
  date: DateKey
  spent: number
  received: number
  count: number
  byCategory: { categoryId: string; total: number }[]
  transactions: Transaction[]
}

export function emptyDay(date: DateKey): DayActivity {
  return { date, spent: 0, received: 0, count: 0, byCategory: [], transactions: [] }
}

/** Every date of the month → what happened that day. */
export function calculateDailySpending(
  txns: readonly Transaction[],
  month: MonthKey,
): Map<DateKey, DayActivity> {
  const days = new Map<DateKey, DayActivity>()
  for (const date of datesInMonth(month)) days.set(date, emptyDay(date))
  const catPaise = new Map<DateKey, Map<string, number>>()
  const spentPaise = new Map<DateKey, number>()
  const recvPaise = new Map<DateKey, number>()
  for (const t of txns) {
    const day = days.get(t.date)
    if (!day) continue
    day.count += 1
    day.transactions.push(t)
    if (t.type === 'expense') {
      spentPaise.set(t.date, (spentPaise.get(t.date) ?? 0) + toPaise(t.amount))
      const cats = catPaise.get(t.date) ?? new Map<string, number>()
      cats.set(t.categoryId, (cats.get(t.categoryId) ?? 0) + toPaise(t.amount))
      catPaise.set(t.date, cats)
    } else {
      recvPaise.set(t.date, (recvPaise.get(t.date) ?? 0) + toPaise(t.amount))
    }
  }
  for (const day of days.values()) {
    day.spent = fromPaise(spentPaise.get(day.date) ?? 0)
    day.received = fromPaise(recvPaise.get(day.date) ?? 0)
    day.transactions.sort(compareTransactionsDesc)
    const cats = catPaise.get(day.date)
    if (cats) {
      day.byCategory = [...cats.entries()]
        .map(([categoryId, p]) => ({ categoryId, total: fromPaise(p) }))
        .sort((a, b) => b.total - a.total)
    }
  }
  return days
}

/**
 * 0 = nothing spent, 1 = a whisper (≤ ₹50) … 5 = dramatic (> ₹2,000).
 * Thresholds are deliberately absolute: ₹1,000 should always look like ₹1,000.
 */
export const INTENSITY_THRESHOLDS = [50, 300, 1000, 2000] as const

export function calculateSpendingIntensity(amount: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (amount <= 0) return 0
  const [a, b, c, d] = INTENSITY_THRESHOLDS
  if (amount <= a) return 1
  if (amount <= b) return 2
  if (amount <= c) return 3
  if (amount <= d) return 4
  return 5
}

// ── Accounts ──────────────────────────────────────────────────────────

/** Balance of one account at the end of `asOf` (inclusive). */
export function calculateAccountBalance(ledger: Ledger, accountId: string, asOf: DateKey): number {
  const account = ledger.accounts.find((a) => a.id === accountId)
  if (!account) return 0
  const asOfMonth = monthOf(asOf)
  const txns = sumPaise(ledger.transactions, (t) =>
    t.accountId === accountId && t.date <= asOf ? signedPaise(t) : 0,
  )
  const adjustments = sumPaise(ledger.monthSettings, (s) =>
    s.adjustmentAccountId === accountId && s.month <= asOfMonth ? toPaise(s.startAdjustment) : 0,
  )
  return fromPaise(toPaise(account.openingBalance) + txns + adjustments)
}

/**
 * "This account actually has ₹X": the opening balance that makes it hold
 * `desired` at the end of `month`. It corrects where the account started,
 * so it never shows up as money in or as spending.
 */
export function openingBalanceFor(ledger: Ledger, accountId: string, month: MonthKey, desired: number): number {
  const account = ledger.accounts.find((a) => a.id === accountId)
  if (!account) return desired
  const current = calculateAccountBalance(ledger, accountId, lastDayOfMonth(month))
  return fromPaise(toPaise(account.openingBalance) + toPaise(desired) - toPaise(current))
}

export interface AccountPosition {
  account: Account
  balance: number
  monthIn: number
  monthOut: number
  share: number
}

/** Where the money sits at the end of `month`. Σ balance === calculateCurrentBalance(month). */
export function calculateAccountBalances(ledger: Ledger, month: MonthKey): AccountPosition[] {
  const asOf = lastDayOfMonth(month)
  const positions = ledger.accounts.map((account) => {
    const inMonth = ledger.transactions.filter((t) => t.accountId === account.id && monthOf(t.date) === month)
    return {
      account,
      balance: calculateAccountBalance(ledger, account.id, asOf),
      monthIn: fromPaise(sumPaise(inMonth, (t) => (t.type === 'income' ? toPaise(t.amount) : 0))),
      monthOut: fromPaise(sumPaise(inMonth, (t) => (t.type === 'expense' ? toPaise(t.amount) : 0))),
      share: 0,
    }
  })
  const positive = sumPaise(positions, (p) => Math.max(0, toPaise(p.balance)))
  for (const p of positions) p.share = positive === 0 ? 0 : Math.max(0, toPaise(p.balance)) / positive
  return positions
}

export function calculateTotalAvailable(positions: readonly AccountPosition[]): number {
  return fromPaise(sumPaise(positions, (p) => toPaise(p.balance)))
}

// ── Patterns ──────────────────────────────────────────────────────────

/** Consecutive spend-free days ending at `today` (today counts only if it's spend-free). */
export function calculateNoSpendStreak(txns: readonly Transaction[], today: DateKey, since: DateKey): number {
  const spendDays = new Set(txns.filter((t) => t.type === 'expense').map((t) => t.date))
  let streak = 0
  let day = today
  while (day >= since && !spendDays.has(day)) {
    streak += 1
    day = addDays(day, -1)
    if (streak > 366) break
  }
  return streak
}

export interface MonthInsights {
  spendDays: number
  calmDays: number
  /** Days that have already happened (or the whole month if it's over). */
  elapsedDays: number
  biggestDay: DayActivity | null
  topCategory: CategorySlice | null
  dailyAverage: number
}

export function calculateMonthInsights(
  days: Map<DateKey, DayActivity>,
  slices: readonly CategorySlice[],
  today: DateKey,
  trackingStart: DateKey,
): MonthInsights {
  let spendDays = 0
  let calmDays = 0
  let biggest: DayActivity | null = null
  let spentPaise = 0
  for (const day of days.values()) {
    if (day.date > today || day.date < trackingStart) continue
    if (day.spent > 0) {
      spendDays += 1
      spentPaise += toPaise(day.spent)
      if (!biggest || day.spent > biggest.spent) biggest = day
    } else {
      calmDays += 1
    }
  }
  const elapsedDays = spendDays + calmDays
  return {
    spendDays,
    calmDays,
    elapsedDays,
    biggestDay: biggest,
    topCategory: slices[0] ?? null,
    // whole rupees: "₹105.65 a day" is false precision
    dailyAverage: elapsedDays === 0 ? 0 : Math.round(spentPaise / elapsedDays / 100),
  }
}

// ── Ordering & grouping ───────────────────────────────────────────────

/** Newest first: date, then time, then creation. */
export function compareTransactionsDesc(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  if (a.time !== b.time) return a.time < b.time ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
}

export interface DayGroup {
  date: DateKey
  transactions: Transaction[]
  spent: number
  received: number
}

export function groupTransactionsByDay(txns: readonly Transaction[]): DayGroup[] {
  const sorted = [...txns].sort(compareTransactionsDesc)
  const groups: DayGroup[] = []
  for (const t of sorted) {
    let g = groups[groups.length - 1]
    if (!g || g.date !== t.date) {
      g = { date: t.date, transactions: [], spent: 0, received: 0 }
      groups.push(g)
    }
    g.transactions.push(t)
  }
  for (const g of groups) {
    g.spent = fromPaise(sumPaise(g.transactions, (t) => (t.type === 'expense' ? toPaise(t.amount) : 0)))
    g.received = fromPaise(sumPaise(g.transactions, (t) => (t.type === 'income' ? toPaise(t.amount) : 0)))
  }
  return groups
}

/**
 * First day that counts for streaks and calm days: when logging began, or the
 * oldest transaction if something was backfilled before that.
 */
export function trackingStartDate(
  txns: readonly Transaction[],
  profile: { startMonth: MonthKey; trackingSince?: DateKey | null },
): DateKey {
  let start = profile.trackingSince ?? firstDayOfMonth(profile.startMonth)
  for (const t of txns) if (t.date < start) start = t.date
  return start
}

/** Earliest navigable month: tracking start or the oldest transaction, whichever is first. */
export function earliestMonth(txns: readonly Transaction[], startMonth: MonthKey): MonthKey {
  let earliest = startMonth
  for (const t of txns) {
    const m = monthOf(t.date)
    if (m < earliest) earliest = m
  }
  return earliest
}

// ── Monthly recap ─────────────────────────────────────────────────────

export interface MonthlySummary {
  month: MonthKey
  startedWith: number
  cameIn: number
  wentMissing: number
  /** came in − went missing (negative when more left than arrived). */
  survived: number
  stillGot: number
  spendDays: number
  calmDays: number
  transactionCount: number
  mostExpensiveCategory: { category: Category; total: number } | null
  mostExpensiveDay: { date: DateKey; spent: number } | null
  /** A day with nothing spent if there was one, else the cheapest spending day. */
  mostPeacefulDay: { date: DateKey; spent: number } | null
  /**
   * The category that grew the most since last month, or — with nothing to
   * compare against — the one he kept going back to.
   */
  mostSuspiciousCategory: {
    category: Category
    total: number
    reason: 'jump' | 'frequent'
    /** rupees up from last month, or number of transactions */
    detail: number
  } | null
}

export function calculateMonthlySummary(
  ledger: Ledger,
  categories: readonly Category[],
  month: MonthKey,
  today: DateKey,
  trackingStart: DateKey,
): MonthlySummary {
  const summary = summarizeMonth(ledger, month)
  const slices = calculateCategorySpending(ledger.transactions, month, categories)
  const days = calculateDailySpending(ledger.transactions, month)
  const insights = calculateMonthInsights(days, slices, today, trackingStart)

  let peaceful: { date: DateKey; spent: number } | null = null
  let cheapest: { date: DateKey; spent: number } | null = null
  for (const day of days.values()) {
    if (day.date > today || day.date < trackingStart) continue
    if (day.spent === 0) peaceful = { date: day.date, spent: 0 }
    else if (!cheapest || day.spent < cheapest.spent) cheapest = { date: day.date, spent: day.spent }
  }

  let suspicious: MonthlySummary['mostSuspiciousCategory'] = null
  const previous = calculateCategorySpending(ledger.transactions, addMonthKey(month, -1), categories)
  if (previous.length && slices.length) {
    const before = new Map(previous.map((s) => [s.category.id, s.total]))
    let best: (typeof slices)[number] | null = null
    let bestJump = 0
    for (const s of slices) {
      const jump = fromPaise(toPaise(s.total) - toPaise(before.get(s.category.id) ?? 0))
      if (jump > bestJump) {
        best = s
        bestJump = jump
      }
    }
    if (best) suspicious = { category: best.category, total: best.total, reason: 'jump', detail: bestJump }
  }
  if (!suspicious && slices.length > 1) {
    const rest = slices.slice(1)
    const frequent = rest.reduce((a, b) => (b.count > a.count ? b : a))
    suspicious = { category: frequent.category, total: frequent.total, reason: 'frequent', detail: frequent.count }
  }

  return {
    month,
    startedWith: summary.starting,
    cameIn: summary.received,
    wentMissing: summary.spent,
    survived: fromPaise(toPaise(summary.received) - toPaise(summary.spent)),
    stillGot: summary.current,
    spendDays: insights.spendDays,
    calmDays: insights.calmDays,
    transactionCount: summary.count,
    mostExpensiveCategory: slices[0] ? { category: slices[0].category, total: slices[0].total } : null,
    mostExpensiveDay: insights.biggestDay ? { date: insights.biggestDay.date, spent: insights.biggestDay.spent } : null,
    mostPeacefulDay: peaceful ?? cheapest,
    mostSuspiciousCategory: suspicious,
  }
}

function addMonthKey(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
