import type { Role, Transaction } from '../data/types'
import { addDays, daysInMonth, monthName, monthOf, parseDate, todayKey, weekdayOf } from '../lib/dates'
import {
  calculateCategorySpending,
  calculateDailySpending,
  calculateMonthInsights,
  calculateNoSpendStreak,
  summarizeMonth,
  trackingStartDate,
} from '../lib/finance'
import { toPaise } from '../lib/money'
import { useData } from '../state/store'
import { ui } from '../state/ui'
import { pickReaction } from './engine'
import type { ReactionContext, ReactionTrigger } from './reactions'

/** "How's he doing" for a given month — what the rules match on. */
export function monthContext(month = monthOf(todayKey())): ReactionContext {
  const s = useData.getState()
  const today = todayKey()
  const since = trackingStartDate(s.transactions, s.profile)
  const ledger = { transactions: s.transactions, accounts: s.accounts, monthSettings: s.monthSettings }
  const summary = summarizeMonth(ledger, month)
  const days = calculateDailySpending(s.transactions, month)
  const slices = calculateCategorySpending(s.transactions, month, s.categories)
  const insights = calculateMonthInsights(days, slices, today, since)
  const total = summary.starting + summary.received
  const current = monthOf(today)
  const dayOfMonth = parseDate(today).day
  const length = daysInMonth(month)
  return {
    spentToday: days.get(today)?.spent ?? 0,
    spentMonth: summary.spent,
    receivedMonth: summary.received,
    balance: summary.current,
    survived: summary.received - summary.spent,
    noSpendStreak: calculateNoSpendStreak(s.transactions, today, since),
    topCategory: slices[0]?.category.name,
    categoryKey: undefined,
    calmDays: insights.calmDays,
    monthProgress: month < current ? 1 : month > current ? 0 : dayOfMonth / length,
    daysLeft: month === current ? length - dayOfMonth : month > current ? length : 0,
    spentRatio: total > 0 ? summary.spent / total : summary.spent > 0 ? 1 : 0,
    hour: new Date().getHours(),
    weekend: [0, 6].includes(weekdayOf(today)),
    viewer: s.viewer?.role,
    name: s.profile.displayName || s.members.find((m) => m.role === 'owner')?.name || 'Jais',
    month: monthName(month),
  }
}

function transactionContext(tx: Transaction): ReactionContext {
  const s = useData.getState()
  const others = s.transactions.filter((t) => t.id !== tx.id)
  const category = s.categories.find((c) => c.id === tx.categoryId)
  const merchant = tx.description.trim()
  const windowStart = addDays(tx.date, -1)
  const weekStart = addDays(tx.date, -6)
  const sameCategoryRecent = s.transactions.filter(
    (t) => t.type === tx.type && t.categoryId === tx.categoryId && t.date >= windowStart && t.date <= tx.date,
  ).length
  const sameMerchantRecent = merchant
    ? s.transactions.filter(
        (t) => t.type === tx.type && t.description.trim().toLowerCase() === merchant.toLowerCase() && t.date >= weekStart && t.date <= tx.date,
      ).length
    : 0
  const since = trackingStartDate(s.transactions, s.profile)
  const streakBefore = tx.type === 'expense' ? calculateNoSpendStreak(others, addDays(tx.date, -1), since) : 0
  const ledgerBefore = { transactions: others, accounts: s.accounts, monthSettings: s.monthSettings }
  const balanceBefore = summarizeMonth(ledgerBefore, monthOf(tx.date)).current
  const firstOfMonth =
    tx.type === 'expense' && !others.some((t) => t.type === 'expense' && monthOf(t.date) === monthOf(tx.date) && t.date <= tx.date)
  const [h] = tx.time.split(':').map(Number)
  return {
    ...monthContext(monthOf(tx.date)),
    amount: tx.amount,
    categoryKey: category?.key ?? null,
    merchant: merchant || undefined,
    sameCategoryRecent,
    sameMerchantRecent,
    streakBefore,
    shareOfBalance: balanceBefore > 0 ? toPaise(tx.amount) / toPaise(balanceBefore) : 1,
    firstOfMonth,
    hour: h,
    weekend: [0, 6].includes(weekdayOf(tx.date)),
  }
}

/** Make her say something (if reactions are on). */
export function react(trigger: ReactionTrigger, tx?: Transaction, extra: Partial<ReactionContext> & { actor?: Role } = {}) {
  const { prefs } = useData.getState().profile
  if (!prefs.mascotVisible || !prefs.reactions) return
  const ctx = { ...(tx ? transactionContext(tx) : monthContext()), ...extra }
  const picked = pickReaction(trigger, ctx, prefs.judginess)
  if (picked) ui.say(picked, Math.max(2800, picked.message.length * 90))
}

/** A line for a screen to display (recaps, Khushi's verdict) without the bubble. */
export function lineFor(trigger: ReactionTrigger, month: string, extra: Partial<ReactionContext> = {}) {
  const s = useData.getState()
  const ctx = { ...monthContext(month), ...extra }
  return pickReaction(trigger, ctx, s.profile.prefs.judginess)
}
