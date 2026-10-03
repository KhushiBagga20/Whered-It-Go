import { describe, expect, it, vi } from 'vitest'
import { buildDefaultAccounts, buildDefaultCategories } from '../data/defaults'
import { buildDemoSnapshot } from '../data/demo'
import { expressionForAmount, pickReaction } from '../mascot/engine'
import { REACTIONS } from '../mascot/reactions'
import { ui, useUi } from '../state/ui'
import { transactionsToCsv } from './export'
import { hasErrors, validateName, validateTransaction } from './validation'

describe('mascot reactions', () => {
  const never = () => 0.99 // chance-gated rules (minimal "👁️👁️", weekend) stay out
  const always = () => 0
  const rule = (amount: number, categoryKey: string | null = 'other', extra = {}, rng = never) =>
    pickReaction('expense', { amount, categoryKey, hour: 14, ...extra }, 'normal', undefined, rng)?.ruleId

  it('scales with the amount', () => {
    expect(rule(40)).toBe('expense-small')
    expect(rule(320)).toBe('expense-moderate')
    expect(rule(800)).toBe('expense-large')
    expect(rule(1850)).toBe('expense-huge')
  })

  it('has something to say about every main category', () => {
    expect(rule(220, 'shopping')).toBe('expense-shopping')
    expect(rule(80, 'transport')).toBe('expense-transport')
    expect(rule(120, 'food')).toBe('expense-food')
    expect(rule(280, 'entertainment')).toBe('expense-entertainment')
    expect(rule(199, 'subscriptions')).toBe('expense-subscriptions')
    expect(rule(350, 'gifts')).toBe('expense-gift')
    expect(rule(180, 'health')).toBe('expense-health')
    expect(rule(120, 'college')).toBe('expense-college')
  })

  it('notices patterns', () => {
    expect(rule(120, 'food', { sameCategoryRecent: 3 })).toBe('expense-food-repeat')
    expect(rule(250, 'food', { hour: 1 })).toBe('expense-food-late')
    expect(rule(160, 'food', { sameMerchantRecent: 3, merchant: 'Zomato' })).toBe('expense-same-merchant')
    expect(rule(90, 'other', { streakBefore: 4 })).toBe('expense-streak-broken')
    expect(rule(900, 'other', { shareOfBalance: 0.45 })).toBe('expense-most-of-it')
    expect(rule(900, 'shopping')).toBe('expense-large') // big beats category quips
  })

  it('sometimes just stares', () => {
    expect(rule(320, 'other', {}, always)).toBe('expense-minimal')
    expect(rule(2400, 'other', {}, always)).toBe('expense-huge') // huge is never minimal
  })

  it('judginess moves the thresholds', () => {
    const at = (j: 'chill' | 'strict') => pickReaction('expense', { amount: 800, categoryKey: 'other' }, j, undefined, never)?.ruleId
    expect(at('chill')).toBe('expense-moderate')
    expect(at('strict')).toBe('expense-huge')
  })

  it('knows who is looking and who did it', () => {
    expect(pickReaction('greet', { viewer: 'observer', hour: 14 }, 'normal', undefined, never)?.ruleId).toBe('greet-khushi')
    expect(pickReaction('edit', { actor: 'observer' }, 'normal', undefined, never)?.ruleId).toBe('edit-by-khushi')
    expect(pickReaction('edit', { actor: 'owner' }, 'normal', undefined, never)?.ruleId).toBe('edit')
  })

  it('wraps up months', () => {
    const end = (survived: number, receivedMonth: number) =>
      pickReaction('month-end', { survived, receivedMonth, spentMonth: 100 }, 'normal', undefined, never)?.ruleId
    expect(end(-430, 2000)).toBe('month-end-negative')
    expect(end(900, 2000)).toBe('month-end-comfortable')
    expect(end(100, 2000)).toBe('month-end')
  })

  it('fills in every template without leftovers', () => {
    const ctx = {
      amount: 640, merchant: 'Zomato', spentMonth: 2430, spentToday: 720, receivedMonth: 2000, balance: 7570,
      topCategory: 'Food', calmDays: 9, noSpendStreak: 4, streakBefore: 3, shareOfBalance: 0.4, daysLeft: 7,
      month: 'September', name: 'Jais', survived: -430,
    }
    for (const r of REACTIONS) {
      for (let i = 0; i < r.messages.length + 2; i++) {
        const picked = pickReaction(r.trigger, ctx, 'normal', [r], () => (i % 10) / 10)
        if (picked) expect(picked.message, r.id).not.toMatch(/[{}]/)
      }
    }
  })

  it('maps every mood to a drawable face', () => {
    const faces = ['neutral', 'happy', 'judging', 'shocked', 'suspicious', 'proud', 'sleepy', 'love']
    for (const r of REACTIONS) {
      const p = pickReaction(r.trigger, { amount: 1 }, 'normal', [{ ...r, when: undefined, chance: undefined }], never)
      expect(faces, r.id).toContain(p?.expression)
    }
  })

  it('has a properly big library', () => {
    expect(REACTIONS.reduce((n, r) => n + r.messages.length, 0)).toBeGreaterThan(200)
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

describe('CSV export', () => {
  it('includes Khushi’s notes and defuses spreadsheet formulas', () => {
    const snap = buildDemoSnapshot()
    const note = snap.comments.find((c) => c.comment.startsWith('large fries'))!
    const mcd = snap.transactions.find((t) => t.id === note.transactionId)!
    snap.transactions = snap.transactions.map((t) => (t.id === mcd.id ? { ...t, description: '=HYPERLINK("x")' } : t))
    const csv = transactionsToCsv(snap)
    const [header, ...rows] = csv.split('\r\n')
    expect(header.endsWith(',note,khushi_notes')).toBe(true)
    expect(rows).toHaveLength(snap.transactions.length)
    const row = rows.find((r) => r.includes('HYPERLINK'))!
    expect(row).toContain(`"'=HYPERLINK(""x"")"`)
    expect(row).toContain('large fries were NOT necessary.')
    // negative amounts are numbers, not text — left alone
    expect(row).toMatch(/,-320\.00,/)
  })
})

describe('toasts', () => {
  it('a sticky toast outlives its timeout and newer toasts', () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', globalThis)
    useUi.setState({ toasts: [] })
    const update = ui.toast('new version', { sticky: true })
    for (const n of [1, 2, 3, 4]) ui.toast(`toast ${n}`)
    // ordinary slips are still capped at three; the sticky one is never the one dropped
    expect(useUi.getState().toasts.map((t) => t.message)).toEqual(['new version', 'toast 2', 'toast 3', 'toast 4'])
    vi.advanceTimersByTime(60_000)
    expect(useUi.getState().toasts.map((t) => t.message)).toEqual(['new version'])
    ui.dismissToast(update)
    expect(useUi.getState().toasts).toEqual([])
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})
