import type { Account, Category, TransactionDraft } from '../data/types'
import { isValidDateKey, isValidTimeKey } from './dates'
import { toPaise } from './money'

export type FieldErrors = Partial<Record<'type' | 'amount' | 'description' | 'categoryId' | 'accountId' | 'date' | 'time' | 'note', string>>

export const MAX_AMOUNT = 1_00_00_000 // ₹1 crore — anything bigger is a typo

/**
 * Validates a transaction draft against the current categories/accounts.
 * Messages are plain and specific; the jokes live elsewhere.
 */
export function validateTransaction(
  draft: Partial<TransactionDraft>,
  ctx: { categories: readonly Category[]; accounts: readonly Account[] },
): FieldErrors {
  const errors: FieldErrors = {}

  if (draft.type !== 'expense' && draft.type !== 'income') {
    errors.type = 'Pick Spent or Received.'
  }

  const amount = draft.amount
  if (amount === undefined || Number.isNaN(amount)) {
    errors.amount = 'Enter an amount.'
  } else if (amount <= 0) {
    errors.amount = 'Amount has to be more than ₹0.'
  } else if (Math.abs(amount * 100 - toPaise(amount)) > 1e-6) {
    errors.amount = 'Rupees and paise only — two decimals max.'
  } else if (toPaise(amount) < 1) {
    errors.amount = 'That amount is too small.'
  } else if (amount > MAX_AMOUNT) {
    errors.amount = 'That’s more than ₹1 crore. Typo?'
  }

  if ((draft.description ?? '').length > 80) {
    errors.description = 'Keep it under 80 characters.'
  }

  const category = ctx.categories.find((c) => c.id === draft.categoryId)
  if (!draft.categoryId || !category) {
    errors.categoryId = 'Pick a category.'
  } else if (draft.type && category.kind !== draft.type) {
    errors.categoryId = draft.type === 'expense' ? 'Pick a spending category.' : 'Pick where the money came from.'
  }

  const account = ctx.accounts.find((a) => a.id === draft.accountId)
  if (!draft.accountId || !account) {
    errors.accountId = 'Pick an account.'
  }

  if (!draft.date || !isValidDateKey(draft.date)) {
    errors.date = 'That date doesn’t exist.'
  }
  if (!draft.time || !isValidTimeKey(draft.time)) {
    errors.time = 'That time doesn’t look right.'
  }
  if ((draft.note ?? '').length > 280) {
    errors.note = 'Notes max out at 280 characters.'
  }

  return errors
}

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0

export function validateName(name: string, existing: readonly string[], what: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return `Give the ${what} a name.`
  if (trimmed.length > 24) return 'Keep it under 24 characters.'
  if (existing.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
    return `You already have a ${what} called “${trimmed}”.`
  }
  return null
}
