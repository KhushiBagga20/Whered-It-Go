import type { Judginess, Role } from '../data/types'
import type { MascotAnimation, MascotExpression, Mood } from './types'

/**
 * Everything tiny Khushi says, as data.
 *
 * The engine (engine.ts) finds every rule whose trigger and conditions
 * match, keeps the highest priority, and picks a random line from it.
 * `chance` lets a rule show up only sometimes — that's how the very
 * minimal reactions ("👁️👁️") sneak in without taking over.
 *
 * Reactions are transient UI personality: nothing here is saved.
 * Amount thresholds are rupees at "normal" judginess; Settings can make
 * her chill (×2) or strict (×0.5).
 *
 * Placeholders: {amount} {merchant} {spentToday} {spentMonth}
 * {receivedMonth} {balance} {topCategory} {streak} {streakBefore}
 * {calmDays} {hour} {name} {month} {share} {daysLeft} {survived}
 */

export type ReactionTrigger =
  | 'expense'
  | 'income'
  | 'edit'
  | 'delete'
  | 'comment'
  | 'note-received'
  | 'poke'
  | 'greet'
  | 'month-end'
  | 'verdict'

export interface ReactionContext {
  amount?: number
  categoryKey?: string | null
  merchant?: string
  /** Same category in the last 48h, including this one. */
  sameCategoryRecent?: number
  /** Same merchant/description in the last 7 days, including this one. */
  sameMerchantRecent?: number
  /** No-spend days in a row right before this expense. */
  streakBefore?: number
  /** No-spend days in a row up to today. */
  noSpendStreak?: number
  spentToday?: number
  spentMonth?: number
  receivedMonth?: number
  /** What's left this month (still got). */
  balance?: number
  /** This amount as a share (0–1) of what he had before it. */
  shareOfBalance?: number
  /** 0 = month just started … 1 = month over. */
  monthProgress?: number
  daysLeft?: number
  /** Spent so far ÷ (started with + came in). */
  spentRatio?: number
  firstOfMonth?: boolean
  topCategory?: string
  calmDays?: number
  /** came in − went missing, for recaps. */
  survived?: number
  hour?: number
  weekend?: boolean
  /** Who is looking at the app. */
  viewer?: Role
  /** Who made the change being reacted to. */
  actor?: Role
  name?: string
  month?: string
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
    minSameMerchant?: number
    minStreakBefore?: number
    minStreak?: number
    maxStreak?: number
    minSpentToday?: number
    maxSpentMonth?: number
    minShareOfBalance?: number
    minSpentRatio?: number
    maxSpentRatio?: number
    minMonthProgress?: number
    maxMonthProgress?: number
    firstOfMonth?: boolean
    weekend?: boolean
    /** inclusive hour window; wraps past midnight when from > to */
    hours?: [from: number, to: number]
    viewer?: Role
    actor?: Role
    survived?: 'positive' | 'negative' | 'comfortable'
  }
  /** 0–1: the rule only applies this often. */
  chance?: number
  mood: Mood
  /** Override the mood's face/move (e.g. heart eyes for gifts). */
  expression?: MascotExpression
  animation?: MascotAnimation
  priority: number
  messages: string[]
}

export const REACTIONS: ReactionRule[] = [
  // ── Spending: the size of it ───────────────────────────────────────
  {
    id: 'expense-minimal',
    trigger: 'expense',
    when: { maxAmount: 1500 },
    chance: 0.12,
    mood: 'suspicious',
    priority: 92,
    messages: ['👁️👁️', '…', 'bro.', 'hm.', '😐', 'k.', '.'],
  },
  {
    id: 'expense-most-of-it',
    trigger: 'expense',
    when: { minShareOfBalance: 0.3, minAmount: 300 },
    mood: 'devastated',
    priority: 110,
    messages: [
      'that was {share}% of everything you have.',
      'you just spent a third of your money. ON WHAT.',
      'there’s barely anything left. I hope it was worth it.',
    ],
  },
  {
    id: 'expense-huge',
    trigger: 'expense',
    when: { minAmount: 1500 },
    mood: 'devastated',
    priority: 100,
    messages: [
      'WHERE’D IT GO?',
      'WHERE’D IT GO??',
      '{amount}. in one go. I need to sit down.',
      'I’m calling your mom.',
      'this is a crime scene.',
      'the money left and it’s not coming back.',
      'I’m not mad. I’m devastated.',
      'oh. OH.',
      '{amount}????',
    ],
  },
  {
    id: 'expense-large',
    trigger: 'expense',
    when: { minAmount: 500, maxAmount: 1500 },
    mood: 'judging',
    priority: 80,
    messages: [
      'bro.',
      'HELLO?',
      'where did THAT come from?',
      '{amount}????',
      'I would like an explanation.',
      'oh we’re spending spending.',
      'interesting financial decision.',
      'okay but why.',
      'that’s a whole week of chai.',
      'the audacity.',
    ],
  },
  {
    id: 'expense-moderate',
    trigger: 'expense',
    when: { minAmount: 150, maxAmount: 500 },
    mood: 'suspicious',
    priority: 20,
    messages: [
      'hmm.',
      'interesting choice.',
      'you sure?',
      'we’re doing this?',
      'okay rich boy.',
      'noted. judged. moving on.',
      'i see.',
      'and this was… necessary?',
      'mm-hm.',
      'go on. explain.',
    ],
  },
  {
    id: 'expense-small',
    trigger: 'expense',
    when: { maxAmount: 150 },
    mood: 'chill',
    priority: 10,
    messages: ['noted.', 'okay.', 'fair.', 'acceptable.', 'carry on.', 'allowed.', 'tiny. fine.', 'i’ll allow it.', 'cute amount.'],
  },

  // ── Spending: patterns ─────────────────────────────────────────────
  {
    id: 'expense-streak-broken',
    trigger: 'expense',
    when: { minStreakBefore: 2, maxAmount: 1500 },
    mood: 'devastated',
    priority: 88,
    messages: [
      'it was nice while it lasted.',
      'and there goes the streak.',
      'I knew peace couldn’t last.',
      '{streakBefore} days. {streakBefore} beautiful days. gone.',
      'the streak has left the chat.',
    ],
  },
  {
    id: 'expense-same-merchant',
    trigger: 'expense',
    when: { minSameMerchant: 3, maxAmount: 1500 },
    mood: 'evil',
    priority: 70,
    messages: [
      '{merchant} again? loyal.',
      'you and {merchant}. name a more iconic duo.',
      '{merchant} has a favourite customer.',
      'at this point {merchant} should pay YOU.',
    ],
  },
  {
    id: 'expense-food-repeat',
    trigger: 'expense',
    when: { categories: ['food'], minRepeat: 3, maxAmount: 500 },
    mood: 'judging',
    priority: 66,
    messages: [
      'you again.',
      'another one??',
      'food. AGAIN.',
      'third time. I’m counting.',
      'do they know you by name yet?',
      'the delivery guy is basically family now.',
    ],
  },
  {
    id: 'expense-food-late',
    trigger: 'expense',
    when: { categories: ['food'], hours: [23, 4], maxAmount: 1500 },
    mood: 'suspicious',
    expression: 'sleepy',
    priority: 72,
    messages: [
      'midnight snack detected.',
      'it’s {hour} o’clock. why are we eating.',
      'nothing good is ordered after midnight.',
      'sleep is free, you know.',
    ],
  },
  {
    id: 'expense-food',
    trigger: 'expense',
    when: { categories: ['food'], maxAmount: 500 },
    mood: 'judging',
    priority: 45,
    messages: [
      'you again.',
      'do you actually live here?',
      'at this point just marry the restaurant.',
      'the food category is fighting for its life.',
      'bro has discovered restaurants.',
      'hungry again? shocking.',
      'your stomach has a better budget than you.',
      'is there a single meal you cook?',
      'Zomato should send you a thank-you card.',
    ],
  },
  {
    id: 'expense-shopping',
    trigger: 'expense',
    when: { categories: ['shopping'], maxAmount: 500 },
    mood: 'suspicious',
    priority: 50,
    messages: [
      'was this necessary?',
      'be honest.',
      'you saw it and folded immediately.',
      'financially? questionable. emotionally? probably worth it.',
      'and what exactly were you supposed to do with this?',
      'okay consumerism.',
      'add to cart is not a personality.',
      'did it at least come in a cute bag?',
      'interesting.',
    ],
  },
  {
    id: 'expense-transport',
    trigger: 'expense',
    when: { categories: ['transport'], maxAmount: 500 },
    mood: 'judging',
    priority: 40,
    messages: [
      'the roads have claimed another victim.',
      'could’ve walked.',
      'okay Uber employee of the month.',
      'the vehicle industry thanks you.',
      'legs exist. just saying.',
      'vroom vroom, there goes the money.',
    ],
  },
  {
    id: 'expense-entertainment',
    trigger: 'expense',
    when: { categories: ['entertainment'], maxAmount: 1500 },
    mood: 'suspicious',
    priority: 38,
    messages: [
      'fun was had, I assume.',
      'was it worth it? don’t answer.',
      'joy is expensive, huh.',
      'I hope you had a great time. the wallet didn’t.',
    ],
  },
  {
    id: 'expense-subscriptions',
    trigger: 'expense',
    when: { categories: ['subscriptions'], maxAmount: 1500 },
    mood: 'judging',
    priority: 46,
    messages: ['another subscription? bold.', 'do you even watch it?', 'subscribed to suffering.', 'cancel one. I dare you.'],
  },
  {
    id: 'expense-gift',
    trigger: 'expense',
    when: { categories: ['gifts'], maxAmount: 1500 },
    mood: 'impressed',
    expression: 'love',
    animation: 'hop',
    priority: 86,
    messages: [
      'is this for me?',
      'if this isn’t for me I’m leaving.',
      'a gift? who for? asking nicely.',
      'generous. suspicious, but generous.',
    ],
  },
  {
    id: 'expense-health',
    trigger: 'expense',
    when: { categories: ['health'], maxAmount: 1500 },
    mood: 'concerned',
    expression: 'love',
    priority: 44,
    messages: ['take care of yourself, okay?', 'this one’s allowed.', 'health is wealth. literally, apparently.'],
  },
  {
    id: 'expense-college',
    trigger: 'expense',
    when: { categories: ['college'], maxAmount: 500 },
    mood: 'proud',
    priority: 30,
    messages: [
      'education. respect.',
      'academic weapon behaviour.',
      'the only responsible purchase this week.',
      'college: draining you financially AND spiritually.',
    ],
  },
  {
    id: 'expense-personal',
    trigger: 'expense',
    when: { categories: ['personal'], maxAmount: 500 },
    mood: 'suspicious',
    priority: 30,
    messages: ['self care or self sabotage?', 'you deserve nice things. within reason.', 'glow-up fund, I see.'],
  },
  {
    id: 'expense-running-low',
    trigger: 'expense',
    when: { minSpentRatio: 0.8, maxMonthProgress: 0.75, maxAmount: 1500 },
    mood: 'concerned',
    priority: 60,
    messages: [
      'careful. the month is long and the money is short.',
      '{daysLeft} days left. {balance} left. do the maths.',
      'we are running on vibes now.',
    ],
  },
  {
    id: 'expense-first-of-month',
    trigger: 'expense',
    when: { firstOfMonth: true, maxAmount: 500 },
    mood: 'suspicious',
    priority: 35,
    messages: ['and so it begins.', 'first one of {month}. let’s see how this goes.', 'the {month} spending era has started.'],
  },
  {
    id: 'expense-weekend',
    trigger: 'expense',
    when: { weekend: true, maxAmount: 500 },
    chance: 0.4,
    mood: 'chill',
    priority: 25,
    messages: ['weekend tax.', 'it’s the weekend, I know, I know.', 'weekends are expensive, huh.'],
  },

  // ── Money coming in ────────────────────────────────────────────────
  {
    id: 'income-big',
    trigger: 'income',
    when: { minAmount: 5000 },
    mood: 'impressed',
    expression: 'love',
    priority: 90,
    messages: ['we’re going on a date. you’re paying.', 'RICH. rich rich rich.', 'okay now you can afford me.', 'OH??? MONEY???'],
  },
  {
    id: 'income-small',
    trigger: 'income',
    when: { maxAmount: 300 },
    mood: 'chill',
    expression: 'happy',
    priority: 60,
    messages: ['cute. every rupee counts.', 'a humble deposit.', '{amount}. we take those.'],
  },
  {
    id: 'income',
    trigger: 'income',
    mood: 'impressed',
    priority: 50,
    messages: [
      'OH LOOK. INCOME.',
      'money has entered the chat.',
      'we’re rich.',
      'we’re rich. for approximately 11 minutes.',
      'OH??? MONEY???',
      'character development.',
      'finally, some good news.',
      'quick, spend it on me.',
    ],
  },

  // ── Changes to the evidence ────────────────────────────────────────
  {
    id: 'edit-by-khushi',
    trigger: 'edit',
    when: { actor: 'observer' },
    mood: 'evil',
    priority: 20,
    messages: ['fixed it. you’re welcome.', 'corrected. obviously.', 'there. accurate now.', 'edited. he’ll notice. eventually.'],
  },
  {
    id: 'edit',
    trigger: 'edit',
    mood: 'suspicious',
    priority: 10,
    messages: ['rewriting history, are we?', 'fixed. suspiciously.', 'changing the evidence? bold.'],
  },
  {
    id: 'delete',
    trigger: 'delete',
    mood: 'suspicious',
    priority: 10,
    messages: [
      'evidence destroyed.',
      'I saw that.',
      'deleting it doesn’t un-spend it.',
      'and what was that, hm?',
      'the cover-up begins.',
    ],
  },
  {
    id: 'comment',
    trigger: 'comment',
    mood: 'evil',
    priority: 10,
    messages: ['noted. permanently.', 'it’s on the record now.', 'he’ll see that.', 'pinned to the evidence.'],
  },
  {
    id: 'note-received',
    trigger: 'note-received',
    mood: 'evil',
    priority: 10,
    messages: ['she left a note. good luck.', 'you’ve been commented on.', 'uh oh. a note.', 'read it. I’ll wait.'],
  },

  // ── Poking her ─────────────────────────────────────────────────────
  {
    id: 'poke-week-clean',
    trigger: 'poke',
    when: { minStreak: 7 },
    mood: 'impressed',
    expression: 'love',
    priority: 60,
    messages: ['a whole week?? who taught you this.', '{streak} days clean. I’m emotional.'],
  },
  {
    id: 'poke-streak',
    trigger: 'poke',
    when: { minStreak: 3 },
    mood: 'proud',
    priority: 50,
    messages: [
      'character development?',
      '{streak} days of not spending. who ARE you?',
      'who are you and what have you done with {name}?',
    ],
  },
  {
    id: 'poke-today-clean',
    trigger: 'poke',
    when: { minStreak: 1, maxStreak: 2 },
    mood: 'suspicious',
    priority: 30,
    messages: ['look at you.', 'suspicious.', 'nothing today? genuinely?', 'I’m almost proud.'],
  },
  {
    id: 'poke-big-day',
    trigger: 'poke',
    when: { minSpentToday: 1000 },
    mood: 'judging',
    priority: 45,
    messages: ['{spentToday} today. we need to talk.', 'today has been… a lot.'],
  },
  {
    id: 'poke-nothing-yet',
    trigger: 'poke',
    when: { maxSpentMonth: 0.01 },
    mood: 'suspicious',
    priority: 40,
    messages: ['nothing spent yet. suspicious.', 'a clean month. for now.', 'look at you. financially mysterious.'],
  },
  {
    id: 'poke-as-khushi',
    trigger: 'poke',
    when: { viewer: 'observer' },
    chance: 0.5,
    mood: 'evil',
    priority: 35,
    messages: ['hi me.', 'we’re watching him.', 'go judge something.', 'find the evidence.'],
  },
  {
    id: 'poke',
    trigger: 'poke',
    mood: 'chill',
    priority: 10,
    messages: [
      '{spentMonth} gone this month. just saying.',
      'top category: {topCategory}. shocking.',
      'stop poking me.',
      'I’m watching. always.',
      'where’d it go? I know where it went.',
      '{calmDays} no-spend days so far. proud-ish.',
      'poke me again and I’m checking your Zomato history.',
      'yes?',
      'I’m busy judging.',
      '{balance} left. use it wisely. (you won’t.)',
    ],
  },

  // ── Opening the app ────────────────────────────────────────────────
  {
    id: 'greet-khushi',
    trigger: 'greet',
    when: { viewer: 'observer' },
    mood: 'evil',
    priority: 50,
    messages: ['let’s see what he did.', 'time to investigate.', 'the evidence awaits.', 'hi me. let’s judge.'],
  },
  {
    id: 'greet-streak',
    trigger: 'greet',
    when: { minStreak: 3 },
    mood: 'proud',
    priority: 40,
    messages: ['character development?', '{streak} days clean. don’t ruin it.'],
  },
  {
    id: 'greet-month-ending',
    trigger: 'greet',
    when: { minMonthProgress: 0.9 },
    mood: 'concerned',
    priority: 30,
    messages: ['last few days of {month}. hold on.', '{daysLeft} days left. we can make it.'],
  },
  {
    id: 'greet-late',
    trigger: 'greet',
    when: { hours: [21, 3] },
    mood: 'chill',
    expression: 'sleepy',
    priority: 20,
    messages: ['logging before bed? proud of you.', 'late night check-in. show me the damage.'],
  },
  {
    id: 'greet-morning',
    trigger: 'greet',
    when: { hours: [5, 11] },
    mood: 'chill',
    expression: 'happy',
    priority: 15,
    messages: ['morning. don’t spend anything yet.', 'new day. new chances to not spend money.'],
  },
  {
    id: 'greet',
    trigger: 'greet',
    mood: 'chill',
    expression: 'happy',
    animation: 'hop',
    priority: 10,
    messages: ['hi. show me the damage.', 'back again. what did we buy?', 'oh. it’s you.', 'welcome back to the crime scene.'],
  },

  // ── Month recap ────────────────────────────────────────────────────
  {
    id: 'month-end-nothing',
    trigger: 'month-end',
    when: { maxSpentMonth: 0.01 },
    mood: 'suspicious',
    priority: 40,
    messages: ['a whole month and nothing? I don’t believe you.'],
  },
  {
    id: 'month-end-comfortable',
    trigger: 'month-end',
    when: { survived: 'comfortable' },
    mood: 'proud',
    priority: 30,
    messages: ['We did okay. Don’t let this get to your head.', 'we survived. the money mostly did too.', 'okay. I’m impressed. a little.'],
  },
  {
    id: 'month-end-negative',
    trigger: 'month-end',
    when: { survived: 'negative' },
    mood: 'devastated',
    priority: 30,
    messages: [
      'the money did not survive.',
      'more went out than came in. iconic, in the worst way.',
      'and thus concludes another financial tragedy.',
    ],
  },
  {
    id: 'month-end',
    trigger: 'month-end',
    mood: 'judging',
    priority: 10,
    messages: [
      'and thus concludes another financial tragedy.',
      'we survived. the money did not.',
      'another month. another investigation.',
      'The money had a good run.',
    ],
  },

  // ── Khushi's verdict on the month so far ───────────────────────────
  {
    id: 'verdict-calm',
    trigger: 'verdict',
    when: { maxSpentRatio: 0.3 },
    mood: 'suspicious',
    priority: 30,
    messages: ['honestly? not bad so far.', 'he’s behaving. suspiciously.', 'quiet month. too quiet.'],
  },
  {
    id: 'verdict-chaos',
    trigger: 'verdict',
    when: { minSpentRatio: 0.7 },
    mood: 'concerned',
    priority: 30,
    messages: ['the money is running. help.', 'this is not looking good.', 'current damage: significant.'],
  },
  {
    id: 'verdict-food',
    trigger: 'verdict',
    when: { categories: ['food'] },
    mood: 'judging',
    priority: 20,
    messages: ['the restaurants are winning.', 'food is the main character this month.', 'you’re basically funding a restaurant.'],
  },
  {
    id: 'verdict',
    trigger: 'verdict',
    mood: 'judging',
    priority: 10,
    messages: ['mid-month, mid-chaos.', 'watchable. barely.', 'I’ve seen worse. I’ve seen better.', 'top of the list: {topCategory}.'],
  },
]

export const JUDGINESS_SCALE: Record<Judginess, number> = { chill: 2, normal: 1, strict: 0.5 }
