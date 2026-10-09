import { describe, expect, it } from 'vitest'
import { buildDemoSnapshot } from '../data/demo'
import type { MonthSetting, Transaction } from '../data/types'
import {
  calculateAccountBalance,
  calculateAccountBalances,
  calculateCategorySpending,
  calculateCurrentBalance,
  calculateDailySpending,
  calculateMonthlyIncome,
  calculateMonthlySpending,
  calculateMonthlySummary,
  calculateNoSpendStreak,
  calculateSpendingIntensity,
  calculateStartingBalance,
  calculateTotalAvailable,
  groupTransactionsByDay,
  openingBalanceFor,
  summarizeMonth,
  type Ledger,
} from './finance'
import { formatCompactINR, formatINR, parseAmount, sanitizeAmountInput, sumRupees } from './money'

const demo = buildDemoSnapshot()
const ledger: Ledger = demo

describe('monthly summary (demo data)', () => {
  it('September matches the brief: 8,000 + 2,000 − 2,430 = 7,570', () => {
    const s = summarizeMonth(ledger, '2026-09')
    expect(s.starting).toBe(8000)
    expect(s.received).toBe(2000)
    expect(s.spent).toBe(2430)
    expect(s.current).toBe(7570)
  })

  it('August rolls into September', () => {
    expect(calculateStartingBalance(ledger, '2026-08')).toBe(10600)
    expect(calculateCurrentBalance(ledger, '2026-08')).toBe(8000)
    expect(calculateStartingBalance(ledger, '2026-09')).toBe(calculateCurrentBalance(ledger, '2026-08'))
  })

  it('an empty future month starts with the previous month’s ending', () => {
    const oct = summarizeMonth(ledger, '2026-10')
    expect(oct.starting).toBe(7570)
    expect(oct.spent).toBe(0)
    expect(oct.current).toBe(7570)
  })

  it('income and spending only count their own month', () => {
    expect(calculateMonthlyIncome(demo.transactions, '2026-08')).toBe(1000)
    expect(calculateMonthlySpending(demo.transactions, '2026-08')).toBe(3600)
  })
})

describe('categories', () => {
  it('groups September spending and merchants', () => {
    const slices = calculateCategorySpending(demo.transactions, '2026-09', demo.categories)
    const byName = Object.fromEntries(slices.map((s) => [s.category.name, s.total]))
    expect(byName).toMatchObject({ Food: 820, Transport: 400, Shopping: 620, Entertainment: 280, College: 180, Other: 130 })
    const food = slices.find((s) => s.category.name === 'Food')!
    expect(food.merchants.map((m) => [m.label, m.total])).toEqual([
      ['McDonald’s', 320],
      ['Zomato', 280],
      ['Cafe', 220],
    ])
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1)
    expect(slices[0].category.name).toBe('Food')
  })
})

describe('days', () => {
  it('23 September: ₹720 across food, transport, shopping', () => {
    const days = calculateDailySpending(demo.transactions, '2026-09')
    expect(days.size).toBe(30)
    const d = days.get('2026-09-23')!
    expect(d.spent).toBe(720)
    expect(d.received).toBe(0)
    const names = d.byCategory.map((c) => [demo.categories.find((x) => x.id === c.categoryId)!.name, c.total])
    expect(names).toEqual([
      ['Food', 320],
      ['Shopping', 220],
      ['Transport', 180],
    ])
    expect(days.get('2026-09-14')!.received).toBe(500)
    expect(days.get('2026-09-21')!.count).toBe(0)
  })

  it('intensity scale', () => {
    expect([0, 20, 50, 51, 300, 301, 1000, 1500, 2000, 2001].map(calculateSpendingIntensity)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
    ])
  })

  it('no-spend streak counts back from today', () => {
    expect(calculateNoSpendStreak(demo.transactions, '2026-09-22', '2026-08-01')).toBe(2)
    expect(calculateNoSpendStreak(demo.transactions, '2026-09-23', '2026-08-01')).toBe(0)
  })

  it('groups by day newest first', () => {
    const groups = groupTransactionsByDay(demo.transactions.filter((t) => t.date.startsWith('2026-09')))
    expect(groups[0].date).toBe('2026-09-23')
    expect(groups[0].transactions.map((t) => t.time)).toEqual(['20:42', '18:13', '15:30', '09:05'])
    expect(groups[0].spent).toBe(720)
  })
})

describe('accounts', () => {
  it('account balances sum to the dashboard balance', () => {
    for (const month of ['2026-08', '2026-09', '2026-10']) {
      const positions = calculateAccountBalances(ledger, month)
      expect(calculateTotalAvailable(positions)).toBe(calculateCurrentBalance(ledger, month))
    }
    const sept = calculateAccountBalances(ledger, '2026-09')
    expect(sept.map((p) => [p.account.name, p.balance])).toEqual([
      ['Bank / UPI', 7270],
      ['Cash', 300],
    ])
  })

  it('setting what an account really has corrects its start, not the spending', () => {
    const cash = demo.accounts.find((a) => a.kind === 'cash')!
    const bank = demo.accounts.find((a) => a.kind === 'bank')!
    const before = summarizeMonth(ledger, '2026-09')
    // Cash shows ₹300 at the end of September; the wallet really has ₹450.50.
    const opening = openingBalanceFor(ledger, cash.id, '2026-09', 450.5)
    expect(opening).toBe(cash.openingBalance + 150.5)
    const fixed: Ledger = { ...ledger, accounts: ledger.accounts.map((a) => (a.id === cash.id ? { ...a, openingBalance: opening } : a)) }
    const positions = calculateAccountBalances(fixed, '2026-09')
    expect(positions.find((p) => p.account.id === cash.id)!.balance).toBe(450.5)
    expect(positions.find((p) => p.account.id === bank.id)!.balance).toBe(7270)
    const after = summarizeMonth(fixed, '2026-09')
    expect([after.received, after.spent]).toEqual([before.received, before.spent])
    expect(after.current).toBe(before.current + 150.5)
    expect(calculateTotalAvailable(positions)).toBe(after.current)
    // lowering works too, and typing the same number changes nothing
    expect(openingBalanceFor(ledger, cash.id, '2026-09', 0)).toBe(cash.openingBalance - 300)
    expect(openingBalanceFor(ledger, cash.id, '2026-09', 300)).toBe(cash.openingBalance)
  })

  it('cash never dips below zero in the demo', () => {
    const cash = demo.accounts.find((a) => a.kind === 'cash')!
    for (let d = 1; d <= 23; d++) {
      const date = `2026-09-${String(d).padStart(2, '0')}`
      expect(calculateAccountBalance(ledger, cash.id, date)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('start adjustments', () => {
  it('shifts the month start, rolls forward, and lands on an account', () => {
    const cash = demo.accounts.find((a) => a.kind === 'cash')!
    const settings: MonthSetting[] = [
      { month: '2026-09', startAdjustment: 250, adjustmentAccountId: cash.id, updatedAt: '' },
    ]
    const adjusted: Ledger = { ...ledger, monthSettings: settings }
    const sept = summarizeMonth(adjusted, '2026-09')
    expect(sept.starting).toBe(8250)
    expect(sept.rolledOver).toBe(8000)
    expect(sept.current).toBe(7820)
    expect(calculateStartingBalance(adjusted, '2026-10')).toBe(7820)
    expect(calculateStartingBalance(adjusted, '2026-08')).toBe(10600)
    expect(calculateTotalAvailable(calculateAccountBalances(adjusted, '2026-09'))).toBe(7820)
    expect(calculateAccountBalance(adjusted, cash.id, '2026-08-31')).toBe(300)
    expect(calculateAccountBalance(adjusted, cash.id, '2026-09-01')).toBe(550)
  })
})

describe('edits flow through', () => {
  it('editing and deleting a transaction changes every derived number', () => {
    const txns: Transaction[] = demo.transactions.map((t) =>
      t.description === 'McDonald’s' && t.date === '2026-09-23' ? { ...t, amount: 420 } : t,
    )
    expect(summarizeMonth({ ...ledger, transactions: txns }, '2026-09').current).toBe(7470)
    const without = txns.filter((t) => !(t.description === 'Myntra'))
    expect(summarizeMonth({ ...ledger, transactions: without }, '2026-09').spent).toBe(2430 + 100 - 400)
  })
})

describe('money helpers', () => {
  it('sums without float drift', () => {
    expect(sumRupees([0.1, 0.2])).toBe(0.3)
    expect(sumRupees([19.99, 0.01, 80])).toBe(100)
  })
  it('formats Indian grouping', () => {
    expect(formatINR(7570)).toBe('₹7,570')
    expect(formatINR(123456)).toBe('₹1,23,456')
    expect(formatINR(-2430)).toBe('−₹2,430')
    expect(formatINR(2000, { sign: 'always' })).toBe('+₹2,000')
    expect(formatINR(99.5)).toBe('₹99.50')
    expect(formatCompactINR(1840)).toBe('₹1.8k')
    expect(formatCompactINR(720)).toBe('₹720')
  })
  it('parses and sanitizes typed amounts', () => {
    expect(parseAmount('1,200')).toBe(1200)
    expect(parseAmount('₹ 320.5')).toBe(320.5)
    expect(parseAmount('abc')).toBeNaN()
    expect(sanitizeAmountInput('0012.345.6')).toBe('12.34')
  })
})

describe('monthly recap', () => {
  it('September 2026 as seen on the 23rd', () => {
    const r = calculateMonthlySummary(ledger, demo.categories, '2026-09', '2026-09-23', '2026-08-01')
    expect(r).toMatchObject({ cameIn: 2000, wentMissing: 2430, survived: -430, stillGot: 7570, startedWith: 8000 })
    expect(r.mostExpensiveCategory?.category.name).toBe('Food')
    expect(r.mostExpensiveCategory?.total).toBe(820)
    expect(r.mostExpensiveDay).toEqual({ date: '2026-09-23', spent: 720 })
    expect(r.mostPeacefulDay).toEqual({ date: '2026-09-22', spent: 0 })
    // Shopping went from ₹0 in August to ₹620: the biggest jump
    expect(r.mostSuspiciousCategory).toMatchObject({ reason: 'jump', detail: 620 })
    expect(r.mostSuspiciousCategory?.category.name).toBe('Shopping')
    expect(r.spendDays + r.calmDays).toBe(23)
  })

  it('falls back to the most frequent category with no previous month', () => {
    const r = calculateMonthlySummary(ledger, demo.categories, '2026-08', '2026-09-23', '2026-08-01')
    expect(r.mostSuspiciousCategory?.reason).toBe('frequent')
    expect(r.survived).toBe(-2600)
    expect(r.mostPeacefulDay?.spent).toBe(0)
  })

  it('an empty future month has nothing to say', () => {
    const r = calculateMonthlySummary(ledger, demo.categories, '2026-10', '2026-09-23', '2026-08-01')
    expect(r).toMatchObject({ cameIn: 0, wentMissing: 0, mostExpensiveCategory: null, mostExpensiveDay: null, mostPeacefulDay: null })
  })
})
