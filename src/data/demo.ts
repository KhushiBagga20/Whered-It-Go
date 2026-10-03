/**
 * DEMO DATA — only ever loaded into local (on-device) mode, never into a
 * Supabase account. August + September 2026 of a plausible college budget:
 *
 *   August     10,600 start  +1,000 in  −3,600 out  → 8,000
 *   September   8,000 start  +2,000 in  −2,430 out  → 7,570
 */
import { buildDefaultCategories, buildDefaultProfile, DEFAULT_PREFS } from './defaults'
import { LOCAL_MEMBERS, LOCAL_OWNER_ID } from './localRepo'
import { newId } from '../lib/id'
import type { Account, Snapshot, Transaction, TransactionComment, TxType } from './types'

const KHUSHI_ID = LOCAL_MEMBERS[1].id

type Row = [date: string, time: string, amount: number, category: string, description: string, account: 'bank' | 'upi' | 'cash', note?: string]

const AUGUST_IN: Row[] = [['2026-08-01', '10:15', 1000, 'family', 'Mom', 'upi', 'monthly top-up']]

const AUGUST_OUT: Row[] = [
  ['2026-08-02', '21:30', 240, 'food', 'Zomato', 'upi'],
  ['2026-08-03', '08:40', 200, 'transport', 'Metro recharge', 'upi'],
  ['2026-08-05', '16:20', 90, 'food', 'Cafe', 'upi'],
  ['2026-08-07', '00:05', 199, 'subscriptions', 'Netflix', 'bank'],
  ['2026-08-09', '19:45', 160, 'transport', 'Uber', 'upi'],
  ['2026-08-10', '18:10', 350, 'gifts', 'Flowers for Khushi', 'upi', 'pink ones. obviously.'],
  ['2026-08-13', '11:00', 50, 'college', 'Printouts', 'cash'],
  ['2026-08-15', '15:30', 120, 'entertainment', 'Kite + manja', 'cash'],
  ['2026-08-16', '22:15', 280, 'food', 'McDonald’s', 'upi'],
  ['2026-08-19', '10:40', 180, 'health', 'Pharmacy', 'cash'],
  ['2026-08-22', '19:00', 1200, 'entertainment', 'Concert tickets', 'bank', 'worth it'],
  ['2026-08-22', '23:50', 90, 'transport', 'Auto', 'cash'],
  ['2026-08-25', '17:30', 150, 'personal', 'Haircut', 'cash'],
  ['2026-08-28', '21:05', 232, 'food', 'Zomato', 'upi'],
  ['2026-08-30', '09:00', 59, 'subscriptions', 'Spotify', 'upi'],
]

const SEPTEMBER_IN: Row[] = [
  ['2026-09-01', '10:00', 1500, 'family', 'Mom', 'upi'],
  ['2026-09-14', '18:00', 500, 'work', 'Tutoring', 'cash', 'maths, class 9'],
]

const SEPTEMBER_OUT: Row[] = [
  ['2026-09-02', '08:50', 100, 'transport', 'Metro recharge', 'upi'],
  ['2026-09-02', '13:20', 80, 'food', 'Cafe', 'upi'],
  ['2026-09-04', '11:15', 60, 'college', 'Printouts', 'cash'],
  ['2026-09-05', '21:10', 160, 'food', 'Zomato', 'upi'],
  ['2026-09-06', '17:40', 400, 'shopping', 'Myntra', 'bank', 'the black tee'],
  ['2026-09-08', '18:30', 40, 'transport', 'Rapido', 'upi'],
  ['2026-09-11', '16:45', 70, 'food', 'Cafe', 'upi'],
  ['2026-09-12', '20:00', 200, 'entertainment', 'PVR tickets', 'upi'],
  ['2026-09-15', '19:10', 80, 'transport', 'Auto', 'cash'],
  ['2026-09-16', '12:40', 120, 'college', 'Lab manual', 'upi'],
  ['2026-09-17', '22:05', 120, 'food', 'Zomato', 'upi'],
  ['2026-09-18', '17:00', 130, 'other', 'Laundry', 'cash'],
  ['2026-09-19', '20:30', 80, 'entertainment', 'Arcade', 'cash'],
  ['2026-09-20', '11:30', 70, 'food', 'Cafe', 'cash'],
  ['2026-09-23', '09:05', 100, 'transport', 'Metro recharge', 'upi'],
  ['2026-09-23', '15:30', 220, 'shopping', 'Phone case', 'upi'],
  ['2026-09-23', '18:13', 80, 'transport', 'Auto', 'cash'],
  ['2026-09-23', '20:42', 320, 'food', 'McDonald’s', 'upi', 'large fries were necessary'],
]

export function buildDemoSnapshot(): Snapshot {
  const categories = buildDefaultCategories()
  const ts = '2026-08-01T04:30:00.000Z'
  const account = (name: string, kind: Account['kind'], openingBalance: number, color: number, sortOrder: number): Account => ({
    id: newId(),
    name,
    kind,
    openingBalance,
    color,
    sortOrder,
    archived: false,
    createdAt: ts,
    updatedAt: ts,
  })
  const accounts = [
    account('Bank', 'bank', 7399, 8, 0),
    account('UPI', 'upi', 2311, 5, 1),
    account('Cash', 'cash', 890, 3, 2),
  ]
  const accountFor = { bank: accounts[0].id, upi: accounts[1].id, cash: accounts[2].id }

  const toTx = (type: TxType) => (row: Row): Transaction => {
    const [date, time, amount, key, description, acc, note] = row
    const category = categories.find((c) => c.key === key && c.kind === type)
    if (!category) throw new Error(`demo: missing category ${key}`)
    const created = new Date(`${date}T${time}:00+05:30`).toISOString()
    return {
      id: newId(),
      type,
      amount,
      categoryId: category.id,
      description,
      accountId: accountFor[acc],
      date,
      time,
      note: note ?? null,
      createdAt: created,
      updatedAt: created,
      createdBy: LOCAL_OWNER_ID,
      updatedBy: LOCAL_OWNER_ID,
    }
  }

  const transactions = [
    ...AUGUST_IN.map(toTx('income')),
    ...AUGUST_OUT.map(toTx('expense')),
    ...SEPTEMBER_IN.map(toTx('income')),
    ...SEPTEMBER_OUT.map(toTx('expense')),
  ]

  // Khushi has already been through the evidence: a couple of notes and one fix.
  const find = (description: string, date: string) => transactions.find((t) => t.description === description && t.date === date)!
  const note = (t: Transaction, comment: string, at: string): TransactionComment => ({
    id: newId(),
    transactionId: t.id,
    authorId: KHUSHI_ID,
    comment,
    createdAt: new Date(at).toISOString(),
  })
  const myntra = find('Myntra', '2026-09-06')
  const zomato = find('Zomato', '2026-09-17')
  const mcd = find('McDonald’s', '2026-09-23')
  const comments = [
    note(myntra, 'is this the black tee i said looked good on you. because then it’s allowed.', '2026-09-06T21:10:00+05:30'),
    note(zomato, 'you could’ve told me you were ordering this 😭', '2026-09-17T22:30:00+05:30'),
    note(mcd, 'large fries were NOT necessary.', '2026-09-23T21:02:00+05:30'),
  ]
  const arcade = find('Arcade', '2026-09-19')
  arcade.description = 'Arcade (lost to me)'
  arcade.updatedBy = KHUSHI_ID
  arcade.updatedAt = new Date('2026-09-19T22:05:00+05:30').toISOString()

  return {
    transactions,
    accounts,
    categories,
    monthSettings: [],
    comments,
    members: LOCAL_MEMBERS,
    profile: buildDefaultProfile({
      displayName: 'Jais',
      mascotName: 'Khushi',
      startMonth: '2026-08',
      trackingSince: '2026-08-01',
      onboarded: true,
      prefs: DEFAULT_PREFS,
    }),
  }
}
