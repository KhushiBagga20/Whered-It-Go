import type { Transaction } from '../data/types'
import { addDays, monthOf, todayKey } from '../lib/dates'
import {
  calculateCategorySpending,
  calculateDailySpending,
  calculateMonthInsights,
  calculateMonthlyIncome,
  calculateMonthlySpending,
  calculateNoSpendStreak,
  trackingStartDate,
} from '../lib/finance'
import { useData } from '../state/store'
import { ui } from '../state/ui'
import { pickReaction } from './engine'
import type { ReactionContext, ReactionTrigger } from './reactions'

/** Snapshot of "how's he doing" that reaction rules can match on. */
function baseContext(): ReactionContext {
  const s = useData.getState()
  const today = todayKey()
  const month = monthOf(today)
  const since = trackingStartDate(s.transactions, s.profile)
  const days = calculateDailySpending(s.transactions, month)
  const slices = calculateCategorySpending(s.transactions, month, s.categories)
  const insights = calculateMonthInsights(days, slices, today, since)
  return {
    spentToday: days.get(today)?.spent ?? 0,
    spentMonth: calculateMonthlySpending(s.transactions, month),
    receivedMonth: calculateMonthlyIncome(s.transactions, month),
    noSpendStreak: calculateNoSpendStreak(s.transactions, today, since),
    topCategory: slices[0]?.category.name,
    calmDays: insights.calmDays,
    hour: new Date().getHours(),
    name: s.profile.displayName,
  }
}

function transactionContext(tx: Transaction): ReactionContext {
  const s = useData.getState()
  const category = s.categories.find((c) => c.id === tx.categoryId)
  const windowStart = addDays(tx.date, -1)
  const sameCategoryRecent = s.transactions.filter(
    (t) => t.type === tx.type && t.categoryId === tx.categoryId && t.date >= windowStart && t.date <= tx.date,
  ).length
  const [h] = tx.time.split(':').map(Number)
  return { amount: tx.amount, categoryKey: category?.key ?? null, sameCategoryRecent, hour: h }
}

/** Make her say something (if reactions are on). */
export function react(trigger: ReactionTrigger, tx?: Transaction) {
  const { prefs } = useData.getState().profile
  if (!prefs.mascotVisible || !prefs.reactions) return
  const ctx = { ...baseContext(), ...(tx ? transactionContext(tx) : {}) }
  const picked = pickReaction(trigger, ctx, prefs.judginess)
  if (picked) ui.say(picked, Math.max(2800, picked.message.length * 90))
}
