import type { Transaction, TxType } from '../data/types'

export interface Suggestion {
  label: string
  categoryId: string
  accountId: string
  count: number
}

/**
 * Past descriptions for quick re-entry, most frequent first. Picking one
 * also brings back the category and account it was last logged with.
 */
export function descriptionSuggestions(
  txns: readonly Transaction[],
  type: TxType,
  query: string,
  limit = 6,
): Suggestion[] {
  const q = query.trim().toLowerCase()
  const map = new Map<string, Suggestion & { last: string }>()
  for (const t of txns) {
    if (t.type !== type) continue
    const label = t.description.trim()
    if (!label) continue
    const key = label.toLowerCase()
    const stamp = `${t.date}T${t.time}`
    const entry = map.get(key)
    if (!entry) {
      map.set(key, { label, categoryId: t.categoryId, accountId: t.accountId, count: 1, last: stamp })
    } else {
      entry.count += 1
      if (stamp > entry.last) {
        entry.last = stamp
        entry.categoryId = t.categoryId
        entry.accountId = t.accountId
        entry.label = label
      }
    }
  }
  return [...map.values()]
    .filter((s) => (q ? s.label.toLowerCase().includes(q) && s.label.toLowerCase() !== q : true))
    .sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    .slice(0, limit)
    .map(({ last: _last, ...s }) => s)
}

/** The account most recently used for this kind of transaction. */
export function lastUsedAccount(txns: readonly Transaction[], type: TxType): string | null {
  let best: Transaction | null = null
  for (const t of txns) {
    if (t.type !== type) continue
    if (!best || t.createdAt > best.createdAt) best = t
  }
  return best?.accountId ?? null
}
