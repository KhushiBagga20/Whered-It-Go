import type { Snapshot } from '../data/types'
import { compareTransactionsDesc } from './finance'

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Every transaction, newest first, spreadsheet-friendly. Amounts are signed. */
export function transactionsToCsv(snap: Snapshot): string {
  const cats = new Map(snap.categories.map((c) => [c.id, c.name]))
  const accs = new Map(snap.accounts.map((a) => [a.id, a.name]))
  const header = ['date', 'time', 'type', 'amount', 'signed_amount', 'category', 'description', 'account', 'note']
  const rows = [...snap.transactions].sort(compareTransactionsDesc).map((t) =>
    [
      t.date,
      t.time,
      t.type,
      t.amount.toFixed(2),
      (t.type === 'expense' ? -t.amount : t.amount).toFixed(2),
      cats.get(t.categoryId) ?? '',
      t.description,
      accs.get(t.accountId) ?? '',
      t.note ?? '',
    ]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...rows].join('\r\n')
}

export function snapshotToJson(snap: Snapshot): string {
  return JSON.stringify({ app: 'whereditgo', version: 1, exportedAt: new Date().toISOString(), ...snap }, null, 2)
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
