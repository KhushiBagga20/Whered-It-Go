import { useEffect } from 'react'
import { formatINR } from '../lib/money'
import { react } from '../mascot/react'
import { applyRemoteComment, applyRemoteDelete, applyRemoteTransaction, refresh, useData } from '../state/store'
import { ui } from '../state/ui'

/**
 * Keeps both phones in step. Cloud mode subscribes to Supabase Realtime
 * (RLS still decides what each person receives), and any mode re-reads
 * the ledger when the app comes back to the foreground.
 */
export function useLedgerSync() {
  const mode = useData((s) => s.mode)
  const ownerId = useData((s) => s.ownerId)
  const viewerId = useData((s) => s.viewer?.id ?? null)

  // Back in the foreground after a while: catch up.
  useEffect(() => {
    let last = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 30_000) return
      last = Date.now()
      void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => {
    if (mode !== 'cloud' || !ownerId || !viewerId) return
    let stop: (() => void) | undefined
    let cancelled = false

    void (async () => {
      const [{ getSupabase }, { txFromRow, commentFromRow }] = await Promise.all([
        import('../lib/supabase'),
        import('../data/supabaseRepo'),
      ])
      const sb = await getSupabase()
      if (cancelled) return
      type Row = Parameters<typeof txFromRow>[0]
      type CRow = Parameters<typeof commentFromRow>[0]
      const nameOf = (id: string | null) => useData.getState().members.find((m) => m.id === id)?.name ?? 'Someone'
      const title = (id: string) => useData.getState().transactions.find((t) => t.id === id)?.description || 'a transaction'

      const channel = sb
        .channel(`ledger:${ownerId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${ownerId}` }, (p) => {
          const tx = txFromRow(p.new as Row)
          const fresh = !useData.getState().transactions.some((t) => t.id === tx.id)
          applyRemoteTransaction(tx)
          if (fresh && tx.createdBy !== viewerId) {
            ui.toast(`${nameOf(tx.createdBy)} just ${tx.type === 'expense' ? 'spent' : 'got'} ${formatINR(tx.amount)}${tx.description ? ` · ${tx.description}` : ''}`, {
              action: { label: 'See', run: () => ui.showDetail(tx.id) },
            })
            react(tx.type === 'expense' ? 'expense' : 'income', tx)
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions', filter: `user_id=eq.${ownerId}` }, (p) => {
          const tx = txFromRow(p.new as Row)
          applyRemoteTransaction(tx)
          if (tx.updatedBy && tx.updatedBy !== viewerId) {
            ui.toast(`${nameOf(tx.updatedBy)} edited ${tx.description || 'a transaction'}.`, {
              action: { label: 'See', run: () => ui.showDetail(tx.id) },
            })
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, (p) => {
          const id = (p.old as { id?: string }).id
          if (id) applyRemoteDelete(id)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transaction_comments' }, (p) => {
          const c = commentFromRow(p.new as CRow)
          if (applyRemoteComment(c) && c.authorId !== viewerId) {
            ui.toast(`${nameOf(c.authorId)} left a note on ${title(c.transactionId)}.`, {
              action: { label: 'Read it', run: () => ui.showDetail(c.transactionId) },
            })
            react('note-received')
          }
        })
        .subscribe()
      stop = () => void sb.removeChannel(channel)
    })()

    return () => {
      cancelled = true
      stop?.()
    }
  }, [mode, ownerId, viewerId])
}
