import { describe, expect, it } from 'vitest'
import { buildDefaultAccounts, buildDefaultCategories, DEFAULT_PREFS } from '../data/defaults'
import type { Transaction } from '../data/types'
import { expressionForAmount, pickReaction } from '../mascot/engine'
import { evaluateNudges } from './notifications'
import { hasErrors, validateName, validateTransaction } from './validation'

describe('mascot reactions', () => {
  const rule = (amount: number, categoryKey: string | null = 'transport', extra = {}) =>
    pickReaction('expense', { amount, categoryKey, hour: 14, ...extra })?.ruleId

  it('scales with the amount', () => {
    expect(rule(40)).toBe('expense-small')
    expect(rule(320)).toBe('expense-moderate')
    expect(rule(800)).toBe('expense-large')
    expect(rule(1850)).toBe('expense-huge')
  })

  it('category and pattern rules win where they should', () => {
    expect(rule(220, 'shopping')).toBe('expense-shopping')
    expect(rule(900, 'shopping')).toBe('expense-large')
    expect(rule(120, 'food', { sameCategoryRecent: 3 })).toBe('expense-repeat-food')
    expect(rule(250, 'food', { hour: 1 })).toBe('expense-late-food')
    expect(rule(350, 'gifts')).toBe('expense-gift')
  })

  it('judginess moves the thresholds', () => {
    expect(pickReaction('expense', { amount: 800, categoryKey: 'transport' }, 'chill')?.ruleId).toBe('expense-moderate')
    expect(pickReaction('expense', { amount: 800, categoryKey: 'transport' }, 'strict')?.ruleId).toBe('expense-huge')
  })

  it('fills in message templates', () => {
    for (let i = 0; i < 10; i++) {
      const r = pickReaction('poke', { spentMonth: 2430, topCategory: 'Food', calmDays: 9, noSpendStreak: 0 })
      expect(r?.message).not.toMatch(/[{}]/)
    }
  })

  it('income is celebrated', () => {
    expect(pickReaction('income', { amount: 2000 })?.ruleId).toBe('income')
    expect(pickReaction('income', { amount: 9000 })?.ruleId).toBe('income-big')
  })

  it('live face while typing', () => {
    expect(expressionForAmount(Number.NaN, 'expense', 'normal')).toBe('neutral')
    expect(expressionForAmount(2000, 'expense', 'normal')).toBe('shocked')
    expect(expressionForAmount(2000, 'income', 'normal')).toBe('happy')
  })
})

describe('validation', () => {
  const categories = buildDefaultCategories()
  const accounts = buildDefaultAccounts({ bank: 0, upi: 0, cash: 0 })
  const food = categories.find((c) => c.key === 'food')!
  const family = categories.find((c) => c.key === 'family')!
  const base = {
    type: 'expense' as const,
    amount: 320,
    categoryId: food.id,
    accountId: accounts[0].id,
    description: 'McDonald’s',
    date: '2026-09-23',
    time: '20:42',
    note: null,
  }
  const check = (patch: object) => validateTransaction({ ...base, ...patch }, { categories, accounts })

  it('accepts a normal transaction', () => {
    expect(hasErrors(check({}))).toBe(false)
  })

  it('rejects zero, negative, fractional-paise and absurd amounts', () => {
    expect(check({ amount: 0 }).amount).toBeTruthy()
    expect(check({ amount: -50 }).amount).toBeTruthy()
    expect(check({ amount: 10.555 }).amount).toBeTruthy()
    expect(check({ amount: 2_00_00_000 }).amount).toBeTruthy()
    expect(check({ amount: Number.NaN }).amount).toBeTruthy()
  })

  it('rejects bad dates, times, categories and accounts', () => {
    expect(check({ date: '2026-02-30' }).date).toBeTruthy()
    expect(check({ time: '25:00' }).time).toBeTruthy()
    expect(check({ categoryId: 'nope' }).categoryId).toBeTruthy()
    expect(check({ categoryId: family.id }).categoryId).toBeTruthy()
    expect(check({ accountId: 'nope' }).accountId).toBeTruthy()
    expect(check({ type: 'transfer' }).type).toBeTruthy()
  })

  it('names must be unique and short', () => {
    expect(validateName('  ', [], 'category')).toBeTruthy()
    expect(validateName('food', ['Food'], 'category')).toMatch(/already/)
    expect(validateName('F1', ['Food'], 'category')).toBeNull()
  })
})

describe('nudges', () => {
  const prefs = { ...DEFAULT_PREFS.notifications, enabled: true }
  const tx = (date: string, type: 'expense' | 'income', amount: number): Transaction => ({
    id: Math.random().toString(),
    type,
    amount,
    categoryId: 'c',
    accountId: 'a',
    description: '',
    date,
    time: '12:00',
    note: null,
    createdAt: `${date}T06:30:00.000Z`,
    updatedAt: `${date}T06:30:00.000Z`,
  })
  const evening = new Date(2026, 8, 23, 21, 30)
  const morning = new Date(2026, 8, 23, 9, 0)

  it('does nothing when off', () => {
    expect(evaluateNudges([], { ...prefs, enabled: false }, evening, {})).toBeNull()
  })

  it('asks in the evening when nothing is logged', () => {
    expect(evaluateNudges([], prefs, evening, {})?.kind).toBe('evening')
    expect(evaluateNudges([], prefs, morning, {})).toBeNull()
    expect(evaluateNudges([], prefs, evening, { evening: '2026-09-23' })).toBeNull()
  })

  it('flags a big day once', () => {
    const txns = [tx('2026-09-23', 'expense', 1200), tx('2026-09-23', 'expense', 640)]
    expect(evaluateNudges(txns, prefs, morning, {})?.kind).toBe('big-day')
    expect(evaluateNudges(txns, prefs, morning, { 'big-day': '2026-09-23' })).toBeNull()
  })

  it('celebrates a logged day with no spending', () => {
    expect(evaluateNudges([tx('2026-09-23', 'income', 500)], prefs, evening, {})?.kind).toBe('saving')
  })
})
