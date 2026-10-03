import type { Snapshot } from '../data/types'
import { compareTransactionsDesc } from './finance'

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Typed-in text: a leading = + - @ would run as a formula in Excel/Sheets. */
function textCell(value: string | null | undefined): string {
  const s = value ?? ''
  return csvCell(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s)
}

/** Every transaction, newest first, spreadsheet-friendly. Amounts are signed. */
export function transactionsToCsv(snap: Snapshot): string {
  const cats = new Map(snap.categories.map((c) => [c.id, c.name]))
  const accs = new Map(snap.accounts.map((a) => [a.id, a.name]))
  const notes = new Map<string, string[]>()
  for (const c of [...snap.comments].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
    notes.set(c.transactionId, [...(notes.get(c.transactionId) ?? []), c.comment])
  }
  const header = ['date', 'time', 'type', 'amount', 'signed_amount', 'category', 'description', 'account', 'note', 'khushi_notes']
  const rows = [...snap.transactions].sort(compareTransactionsDesc).map((t) =>
    [
      csvCell(t.date),
      csvCell(t.time),
      csvCell(t.type),
      csvCell(t.amount.toFixed(2)),
      csvCell((t.type === 'expense' ? -t.amount : t.amount).toFixed(2)),
      textCell(cats.get(t.categoryId)),
      textCell(t.description),
      textCell(accs.get(t.accountId)),
      textCell(t.note),
      textCell(notes.get(t.id)?.join(' | ')),
    ].join(','),
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
