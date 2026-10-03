import type { Judginess } from '../data/types'
import { formatINR } from '../lib/money'
import { MOODS } from './moods'
import { JUDGINESS_SCALE, REACTIONS, type ReactionContext, type ReactionRule, type ReactionTrigger } from './reactions'
import type { MascotAnimation, MascotExpression, Mood } from './types'

export interface PickedReaction {
  ruleId: string
  message: string
  mood: Mood
  expression: MascotExpression
  animation: MascotAnimation
}

function inHours(hour: number, [from, to]: [number, number]) {
  return from <= to ? hour >= from && hour <= to : hour >= from || hour <= to
}

function survivedBucket(ctx: ReactionContext): 'positive' | 'negative' | 'comfortable' | null {
  if (ctx.survived === undefined) return null
  if (ctx.survived < 0) return 'negative'
  const cameIn = ctx.receivedMonth ?? 0
  return cameIn > 0 && ctx.survived >= cameIn * 0.3 ? 'comfortable' : 'positive'
}

function matches(rule: ReactionRule, ctx: ReactionContext, scale: number): boolean {
  const w = rule.when
  if (!w) return true
  const amount = ctx.amount ?? 0
  if (w.minAmount !== undefined && amount < w.minAmount * scale) return false
  if (w.maxAmount !== undefined && amount >= w.maxAmount * scale) return false
  if (w.categories && !(ctx.categoryKey && w.categories.includes(ctx.categoryKey))) return false
  if (w.minRepeat !== undefined && (ctx.sameCategoryRecent ?? 0) < w.minRepeat) return false
  if (w.minSameMerchant !== undefined && ((ctx.sameMerchantRecent ?? 0) < w.minSameMerchant || !ctx.merchant)) return false
  if (w.minStreakBefore !== undefined && (ctx.streakBefore ?? 0) < w.minStreakBefore) return false
  if (w.minStreak !== undefined && (ctx.noSpendStreak ?? 0) < w.minStreak) return false
  if (w.maxStreak !== undefined && (ctx.noSpendStreak ?? 0) > w.maxStreak) return false
  if (w.minSpentToday !== undefined && (ctx.spentToday ?? 0) < w.minSpentToday * scale) return false
  if (w.maxSpentMonth !== undefined && (ctx.spentMonth ?? 0) >= w.maxSpentMonth) return false
  if (w.minShareOfBalance !== undefined && (ctx.shareOfBalance ?? 0) < Math.min(1, w.minShareOfBalance * scale)) return false
  if (w.minSpentRatio !== undefined && (ctx.spentRatio ?? 0) < w.minSpentRatio) return false
  if (w.maxSpentRatio !== undefined && (ctx.spentRatio ?? 0) > w.maxSpentRatio) return false
  if (w.minMonthProgress !== undefined && (ctx.monthProgress ?? 0) < w.minMonthProgress) return false
  if (w.maxMonthProgress !== undefined && (ctx.monthProgress ?? 1) > w.maxMonthProgress) return false
  if (w.firstOfMonth !== undefined && Boolean(ctx.firstOfMonth) !== w.firstOfMonth) return false
  if (w.weekend !== undefined && Boolean(ctx.weekend) !== w.weekend) return false
  if (w.hours && !inHours(ctx.hour ?? new Date().getHours(), w.hours)) return false
  if (w.viewer && ctx.viewer !== w.viewer) return false
  if (w.actor && ctx.actor !== w.actor) return false
  if (w.survived && survivedBucket(ctx) !== w.survived) return false
  return true
}

function fill(template: string, ctx: ReactionContext): string {
  const hour = ctx.hour ?? new Date().getHours()
  const values: Record<string, string> = {
    amount: formatINR(ctx.amount ?? 0),
    merchant: ctx.merchant || 'that place',
    spentToday: formatINR(ctx.spentToday ?? 0),
    spentMonth: formatINR(ctx.spentMonth ?? 0),
    receivedMonth: formatINR(ctx.receivedMonth ?? 0),
    balance: formatINR(ctx.balance ?? 0),
    survived: formatINR(Math.abs(ctx.survived ?? 0)),
    topCategory: (ctx.topCategory ?? 'nothing').toLowerCase(),
    streak: String(ctx.noSpendStreak ?? 0),
    streakBefore: String(ctx.streakBefore ?? 0),
    calmDays: String(ctx.calmDays ?? 0),
    hour: String(hour % 12 === 0 ? 12 : hour % 12),
    name: ctx.name || 'you',
    month: ctx.month || 'this month',
    share: String(Math.round((ctx.shareOfBalance ?? 0) * 100)),
    daysLeft: String(ctx.daysLeft ?? 0),
  }
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')
}

/** Lines whose template needs data we don't have shouldn't be picked. */
function usable(message: string, ctx: ReactionContext) {
  if (message.includes('{topCategory}') && !ctx.topCategory) return false
  if (message.includes('{merchant}') && !ctx.merchant) return false
  if (message.includes('{balance}') && ctx.balance === undefined) return false
  return true
}

const lastLine = new Map<string, string>()

/**
 * Pick what she says. Highest-priority matching rule wins (ties broken at
 * random), then a line from it that isn't the one she said last time.
 */
export function pickReaction(
  trigger: ReactionTrigger,
  ctx: ReactionContext,
  judginess: Judginess = 'normal',
  rules: readonly ReactionRule[] = REACTIONS,
  rng: () => number = Math.random,
): PickedReaction | null {
  const scale = JUDGINESS_SCALE[judginess]
  const candidates = rules.filter(
    (r) => r.trigger === trigger && matches(r, ctx, scale) && (r.chance === undefined || rng() < r.chance),
  )
  if (!candidates.length) return null
  const top = Math.max(...candidates.map((r) => r.priority))
  const best = candidates.filter((r) => r.priority === top)
  const rule = best[Math.floor(rng() * best.length)]
  let lines = rule.messages.filter((m) => usable(m, ctx))
  if (!lines.length) lines = rule.messages
  const previous = lastLine.get(rule.id)
  const fresh = lines.length > 1 ? lines.filter((m) => m !== previous) : lines
  const line = fresh[Math.floor(rng() * fresh.length)]
  lastLine.set(rule.id, line)
  const look = MOODS[rule.mood]
  return {
    ruleId: rule.id,
    message: fill(line, ctx),
    mood: rule.mood,
    expression: rule.expression ?? look.expression,
    animation: rule.animation ?? look.animation,
  }
}

/** Her face while he's still typing the amount. */
export function expressionForAmount(amount: number, type: 'expense' | 'income', judginess: Judginess): MascotExpression {
  if (!amount || Number.isNaN(amount)) return 'neutral'
  if (type === 'income') return amount >= 5000 * JUDGINESS_SCALE[judginess] ? 'love' : 'happy'
  const s = JUDGINESS_SCALE[judginess]
  if (amount >= 1500 * s) return 'shocked'
  if (amount >= 500 * s) return 'judging'
  if (amount >= 150 * s) return 'suspicious'
  return 'neutral'
}
