import type { Judginess } from '../data/types'
import type { MascotAnimation, MascotExpression } from './types'

/**
 * Everything she says lives here, as data. The engine picks the matching
 * rule with the highest priority, then a random line from it. To add a
 * reaction: add a rule. No component changes needed.
 *
 * Amount thresholds are in rupees at "normal" judginess; Settings can make
 * her chill (×2) or strict (×0.5).
 */

export type ReactionTrigger = 'expense' | 'income' | 'delete' | 'edit' | 'poke' | 'greet'

export interface ReactionContext {
  amount?: number
  categoryKey?: string | null
  /** Transactions in the same category in the last 48h, including this one. */
  sameCategoryRecent?: number
  noSpendStreak?: number
  spentToday?: number
  spentMonth?: number
  receivedMonth?: number
  topCategory?: string
  calmDays?: number
  hour?: number
  name?: string
}

export interface ReactionRule {
  id: string
  trigger: ReactionTrigger
  when?: {
    minAmount?: number
    /** exclusive */
    maxAmount?: number
    categories?: string[]
    minRepeat?: number
    minStreak?: number
    minSpentToday?: number
    maxSpentMonth?: number
    /** inclusive hour window; wraps past midnight when from > to */
    hours?: [from: number, to: number]
  }
  messages: string[]
  expression: MascotExpression
  animation: MascotAnimation
  priority: number
}

export const REACTIONS: ReactionRule[] = [
  // ── Spending ─────────────────────────────────────────
  {
    id: 'expense-huge',
    trigger: 'expense',
    when: { minAmount: 1500 },
    messages: ['WHERE’D IT GO?', 'WHERE’D IT GO??', '{amount}?? in THIS economy?'],
    expression: 'shocked',
    animation: 'faint',
    priority: 100,
  },
  {
    id: 'expense-large',
    trigger: 'expense',
    when: { minAmount: 500, maxAmount: 1500 },
    messages: ['bro.', 'bro…', '{amount}. in one go. bro.'],
    expression: 'judging',
    animation: 'shake',
    priority: 80,
  },
  {
    id: 'expense-gift',
    trigger: 'expense',
    when: { categories: ['gifts'], maxAmount: 1500 },
    messages: ['is this for me?', 'if this isn’t for me i’m leaving.'],
    expression: 'love',
    animation: 'hop',
    priority: 85,
  },
  {
    id: 'expense-late-food',
    trigger: 'expense',
    when: { categories: ['food'], hours: [23, 4], maxAmount: 1500 },
    messages: ['midnight snack detected.', 'it’s {hour} o’clock. why are we eating.'],
    expression: 'suspicious',
    animation: 'nod',
    priority: 70,
  },
  {
    id: 'expense-repeat-food',
    trigger: 'expense',
    when: { categories: ['food'], minRepeat: 3, maxAmount: 500 },
    messages: ['you again?', 'food. again. i see.'],
    expression: 'suspicious',
    animation: 'nod',
    priority: 65,
  },
  {
    id: 'expense-shopping',
    trigger: 'expense',
    when: { categories: ['shopping'], maxAmount: 500 },
    messages: ['interesting.', 'and what did we buy?'],
    expression: 'suspicious',
    animation: 'nod',
    priority: 50,
  },
  {
    id: 'expense-subscriptions',
    trigger: 'expense',
    when: { categories: ['subscriptions'], maxAmount: 500 },
    messages: ['another subscription? bold.', 'do you even watch it?'],
    expression: 'judging',
    animation: 'nod',
    priority: 45,
  },
  {
    id: 'expense-health',
    trigger: 'expense',
    when: { categories: ['health'], maxAmount: 1500 },
    messages: ['take care of yourself, okay?', 'this one’s allowed.'],
    expression: 'love',
    animation: 'nod',
    priority: 40,
  },
  {
    id: 'expense-college',
    trigger: 'expense',
    when: { categories: ['college'], maxAmount: 500 },
    messages: ['education. respect.', 'academic weapon behaviour.'],
    expression: 'proud',
    animation: 'nod',
    priority: 30,
  },
  {
    id: 'expense-moderate',
    trigger: 'expense',
    when: { minAmount: 150, maxAmount: 500 },
    messages: ['hmm.', 'hmm…', 'noted.'],
    expression: 'judging',
    animation: 'nod',
    priority: 20,
  },
  {
    id: 'expense-small',
    trigger: 'expense',
    when: { maxAmount: 150 },
    messages: ['acceptable.', 'fine. allowed.', 'tiny. i’ll allow it.'],
    expression: 'neutral',
    animation: 'nod',
    priority: 10,
  },

  // ── Money in ─────────────────────────────────────────
  {
    id: 'income-big',
    trigger: 'income',
    when: { minAmount: 5000 },
    messages: ['we’re going on a date. you’re paying.', 'RICH. rich rich rich.'],
    expression: 'love',
    animation: 'spin',
    priority: 90,
  },
  {
    id: 'income-small',
    trigger: 'income',
    when: { maxAmount: 300 },
    messages: ['cute. every rupee counts.', 'a humble deposit.'],
    expression: 'happy',
    animation: 'hop',
    priority: 60,
  },
  {
    id: 'income',
    trigger: 'income',
    messages: ['oh look who’s rich now.', 'money came IN? write this down.'],
    expression: 'happy',
    animation: 'hop',
    priority: 50,
  },

  // ── Edits ────────────────────────────────────────────
  {
    id: 'delete',
    trigger: 'delete',
    messages: ['evidence destroyed.', 'i saw that.', 'deleting it doesn’t un-spend it.'],
    expression: 'suspicious',
    animation: 'shake',
    priority: 10,
  },
  {
    id: 'edit',
    trigger: 'edit',
    messages: ['rewriting history, are we?', 'fixed. suspiciously.'],
    expression: 'suspicious',
    animation: 'nod',
    priority: 10,
  },

  // ── Poking her ───────────────────────────────────────
  {
    id: 'poke-streak',
    trigger: 'poke',
    when: { minStreak: 3 },
    messages: ['character development?', '{streak} days of not spending. who ARE you?'],
    expression: 'proud',
    animation: 'hop',
    priority: 50,
  },
  {
    id: 'poke-big-day',
    trigger: 'poke',
    when: { minSpentToday: 1000 },
    messages: ['{spentToday} today. we need to talk.'],
    expression: 'judging',
    animation: 'shake',
    priority: 45,
  },
  {
    id: 'poke-nothing-yet',
    trigger: 'poke',
    when: { maxSpentMonth: 0.01 },
    messages: ['nothing spent yet. suspicious.', 'a clean month. for now.'],
    expression: 'suspicious',
    animation: 'nod',
    priority: 40,
  },
  {
    id: 'poke',
    trigger: 'poke',
    messages: [
      '{spentMonth} gone this month. just saying.',
      'top category: {topCategory}. shocking.',
      'stop poking me.',
      'i’m watching. always.',
      'where’d it go? i know where it went.',
      '{calmDays} no-spend days so far. proud-ish.',
    ],
    expression: 'neutral',
    animation: 'wiggle',
    priority: 10,
  },

  // ── Opening the app ──────────────────────────────────
  {
    id: 'greet-late',
    trigger: 'greet',
    when: { hours: [21, 3] },
    messages: ['logging before bed? proud of you.', 'late night check-in. show me the damage.'],
    expression: 'sleepy',
    animation: 'nod',
    priority: 20,
  },
  {
    id: 'greet-streak',
    trigger: 'greet',
    when: { minStreak: 3 },
    messages: ['character development?'],
    expression: 'proud',
    animation: 'hop',
    priority: 40,
  },
  {
    id: 'greet',
    trigger: 'greet',
    messages: ['hi. show me the damage.', 'back again. what did we buy?', 'oh. it’s you.'],
    expression: 'happy',
    animation: 'hop',
    priority: 10,
  },
]

export const JUDGINESS_SCALE: Record<Judginess, number> = { chill: 2, normal: 1, strict: 0.5 }
