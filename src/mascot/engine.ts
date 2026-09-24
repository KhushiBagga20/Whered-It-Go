import type { Judginess } from '../data/types'
import { formatINR } from '../lib/money'
import { JUDGINESS_SCALE, REACTIONS, type ReactionContext, type ReactionRule, type ReactionTrigger } from './reactions'
import type { MascotAnimation, MascotExpression } from './types'

export interface PickedReaction {
  ruleId: string
  message: string
  expression: MascotExpression
  animation: MascotAnimation
}

function inHours(hour: number, [from, to]: [number, number]) {
  return from <= to ? hour >= from && hour <= to : hour >= from || hour <= to
}

function matches(rule: ReactionRule, ctx: ReactionContext, scale: number): boolean {
  const w = rule.when
  if (!w) return true
  const amount = ctx.amount ?? 0
  if (w.minAmount !== undefined && amount < w.minAmount * scale) return false
  if (w.maxAmount !== undefined && amount >= w.maxAmount * scale) return false
  if (w.categories && !(ctx.categoryKey && w.categories.includes(ctx.categoryKey))) return false
  if (w.minRepeat !== undefined && (ctx.sameCategoryRecent ?? 0) < w.minRepeat) return false
  if (w.minStreak !== undefined && (ctx.noSpendStreak ?? 0) < w.minStreak) return false
  if (w.minSpentToday !== undefined && (ctx.spentToday ?? 0) < w.minSpentToday * scale) return false
  if (w.maxSpentMonth !== undefined && (ctx.spentMonth ?? 0) >= w.maxSpentMonth) return false
  if (w.hours && !inHours(ctx.hour ?? new Date().getHours(), w.hours)) return false
  return true
}

function fill(template: string, ctx: ReactionContext): string {
  const hour = ctx.hour ?? new Date().getHours()
  const values: Record<string, string> = {
    amount: formatINR(ctx.amount ?? 0),
    spentToday: formatINR(ctx.spentToday ?? 0),
    spentMonth: formatINR(ctx.spentMonth ?? 0),
    receivedMonth: formatINR(ctx.receivedMonth ?? 0),
    topCategory: (ctx.topCategory ?? 'nothing').toLowerCase(),
    streak: String(ctx.noSpendStreak ?? 0),
    calmDays: String(ctx.calmDays ?? 0),
    hour: String(hour % 12 === 0 ? 12 : hour % 12),
    name: ctx.name || 'you',
  }
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '')
}

/** Lines whose template needs data we don't have shouldn't be picked. */
function usable(message: string, ctx: ReactionContext) {
  if (message.includes('{topCategory}') && !ctx.topCategory) return false
  return true
}

const lastLine = new Map<string, string>()

export function pickReaction(
  trigger: ReactionTrigger,
  ctx: ReactionContext,
  judginess: Judginess = 'normal',
  rules: readonly ReactionRule[] = REACTIONS,
): PickedReaction | null {
  const scale = JUDGINESS_SCALE[judginess]
  const candidates = rules.filter((r) => r.trigger === trigger && matches(r, ctx, scale))
  if (!candidates.length) return null
  const top = Math.max(...candidates.map((r) => r.priority))
  const best = candidates.filter((r) => r.priority === top)
  const rule = best[Math.floor(Math.random() * best.length)]
  let lines = rule.messages.filter((m) => usable(m, ctx))
  if (!lines.length) lines = rule.messages
  // Don't repeat the exact same line twice in a row.
  const previous = lastLine.get(rule.id)
  const fresh = lines.length > 1 ? lines.filter((m) => m !== previous) : lines
  const line = fresh[Math.floor(Math.random() * fresh.length)]
  lastLine.set(rule.id, line)
  return { ruleId: rule.id, message: fill(line, ctx), expression: rule.expression, animation: rule.animation }
}

/** Her face while you're still typing the amount. */
export function expressionForAmount(amount: number, type: 'expense' | 'income', judginess: Judginess): MascotExpression {
  if (!amount || Number.isNaN(amount)) return 'neutral'
  if (type === 'income') return amount >= 5000 * JUDGINESS_SCALE[judginess] ? 'love' : 'happy'
  const s = JUDGINESS_SCALE[judginess]
  if (amount >= 1500 * s) return 'shocked'
  if (amount >= 500 * s) return 'judging'
  if (amount >= 150 * s) return 'suspicious'
  return 'neutral'
}
