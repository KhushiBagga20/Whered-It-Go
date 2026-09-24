import { create } from 'zustand'
import { buildDefaultAccounts, buildDefaultCategories, buildDefaultProfile, withPrefDefaults } from '../data/defaults'
import { LocalRepository, readLocalMeta, writeLocalMeta } from '../data/localRepo'
import { RepositoryError, type Repository } from '../data/repository'
import type {
  Account,
  Category,
  MonthKey,
  MonthSetting,
  Prefs,
  Profile,
  Snapshot,
  Transaction,
  TransactionDraft,
} from '../data/types'
import { currentMonthKey, todayKey } from '../lib/dates'
import { newId, nowIso } from '../lib/id'
import { isCloudConfigured } from '../lib/supabase'
import { ui } from './ui'

export type BootStatus = 'booting' | 'signed-out' | 'onboarding' | 'ready' | 'error'

interface DataState extends Snapshot {
  status: BootStatus
  mode: 'local' | 'cloud'
  demo: boolean
  email: string | null
  /** Writes in flight (for the tiny sync indicator). */
  pending: number
  bootError: { message: string; detail?: string } | null
}

const emptySnapshot = (): Snapshot => ({
  transactions: [],
  accounts: [],
  categories: [],
  monthSettings: [],
  profile: buildDefaultProfile(),
})

export const useData = create<DataState>(() => ({
  ...emptySnapshot(),
  status: 'booting',
  mode: isCloudConfigured ? 'cloud' : 'local',
  demo: false,
  email: null,
  pending: 0,
  bootError: null,
}))

let repo: Repository | null = null
const CACHE_PREFIX = 'wig:cache:'

function snapshotOf(s: DataState): Snapshot {
  return {
    transactions: s.transactions,
    accounts: s.accounts,
    categories: s.categories,
    monthSettings: s.monthSettings,
    profile: s.profile,
  }
}

/** Cloud mode keeps a copy on the device so the app opens instantly (and offline). */
function cacheSnapshot() {
  const s = useData.getState()
  if (s.mode !== 'cloud' || !s.email) return
  try {
    localStorage.setItem(CACHE_PREFIX + s.email, JSON.stringify(snapshotOf(s)))
  } catch {
    // cache is best-effort
  }
}

function readCache(email: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + email)
    if (!raw) return null
    const snap = JSON.parse(raw) as Snapshot
    snap.profile.prefs = withPrefDefaults(snap.profile.prefs)
    return snap
  } catch {
    return null
  }
}

function applySnapshot(snap: Snapshot, extra: Partial<DataState> = {}) {
  useData.setState({
    ...snap,
    profile: { ...snap.profile, prefs: withPrefDefaults(snap.profile.prefs) },
    status: snap.profile.onboarded ? 'ready' : 'onboarding',
    bootError: null,
    ...extra,
  })
  // Land on the latest month that has data (or today's month).
  ui.setMonth(currentMonthKey())
}

function describe(e: unknown): { message: string; detail?: string } {
  if (e instanceof RepositoryError) return { message: e.message, detail: e.detail }
  if (e instanceof Error) return { message: 'Something broke.', detail: e.message }
  return { message: 'Something broke.', detail: String(e) }
}

// ── Boot ───────────────────────────────────────────────────────────────

export async function boot(): Promise<void> {
  useData.setState({ status: 'booting', bootError: null })
  try {
    if (!isCloudConfigured) {
      await bootLocal()
      return
    }
    const { getSupabase } = await import('../lib/supabase')
    const sb = await getSupabase()
    const { data } = await sb.auth.getSession()
    const session = data.session
    if (!session?.user) {
      useData.setState({ status: 'signed-out', mode: 'cloud' })
      return
    }
    await bootCloud(session.user.id, session.user.email ?? session.user.id)
  } catch (e) {
    useData.setState({ status: 'error', bootError: describe(e) })
  }
}

async function bootLocal() {
  const local = new LocalRepository()
  repo = local
  let snap = await local.load()
  let demo = readLocalMeta().demo
  if (!snap) {
    const { buildDemoSnapshot } = await import('../data/demo')
    snap = buildDemoSnapshot()
    await local.replaceAll(snap)
    demo = true
    writeLocalMeta({ demo })
  }
  applySnapshot(snap, { mode: 'local', demo, email: null })
}

export async function bootCloud(userId: string, email: string) {
  const [{ getSupabase }, { SupabaseRepository }] = await Promise.all([
    import('../lib/supabase'),
    import('../data/supabaseRepo'),
  ])
  const sb = await getSupabase()
  repo = new SupabaseRepository(sb, userId)
  useData.setState({ mode: 'cloud', email, demo: false })

  const cached = readCache(email)
  if (cached) applySnapshot(cached, { mode: 'cloud', email })

  try {
    const fresh = await repo.load()
    if (fresh) {
      applySnapshot(fresh, { mode: 'cloud', email })
      cacheSnapshot()
    } else {
      useData.setState({ ...emptySnapshot(), status: 'onboarding', mode: 'cloud', email })
    }
  } catch (e) {
    // Offline with a cache: keep going on cached data and say so.
    if (cached) ui.toast('Showing saved data — couldn’t reach the server.', { tone: 'error', detail: describe(e).detail })
    else throw e
  }
}

export async function signOut() {
  const s = useData.getState()
  if (s.mode === 'cloud') {
    const { getSupabase } = await import('../lib/supabase')
    const sb = await getSupabase()
    await sb.auth.signOut()
    if (s.email) localStorage.removeItem(CACHE_PREFIX + s.email)
  }
  repo = null
  useData.setState({ ...emptySnapshot(), status: 'signed-out', email: null })
}

// ── Write helper: optimistic, rolled back on failure ──────────────────

async function write(label: string, optimistic: Partial<DataState>, persist: (r: Repository) => Promise<void>) {
  if (!repo) throw new RepositoryError('Not signed in.')
  const before = snapshotOf(useData.getState())
  useData.setState((s) => ({ ...optimistic, pending: s.pending + 1 }))
  try {
    await persist(repo)
    cacheSnapshot()
  } catch (e) {
    useData.setState({ ...before })
    const { message, detail } = describe(e)
    ui.toast(`${label} didn’t save. ${message}`, { tone: 'error', detail })
    throw e
  } finally {
    useData.setState((s) => ({ pending: Math.max(0, s.pending - 1) }))
  }
}

// ── Transactions ──────────────────────────────────────────────────────

export async function saveTransaction(draft: TransactionDraft): Promise<{ tx: Transaction; created: boolean }> {
  const s = useData.getState()
  const existing = draft.id ? s.transactions.find((t) => t.id === draft.id) : undefined
  const ts = nowIso()
  const tx: Transaction = {
    ...draft,
    description: draft.description.trim(),
    note: draft.note?.trim() ? draft.note.trim() : null,
    id: existing?.id ?? draft.id ?? newId(),
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  }
  const transactions = existing ? s.transactions.map((t) => (t.id === tx.id ? tx : t)) : [...s.transactions, tx]
  await write('That', { transactions }, (r) => r.saveTransaction(tx))
  return { tx, created: !existing }
}

export async function deleteTransaction(id: string): Promise<Transaction | undefined> {
  const s = useData.getState()
  const victim = s.transactions.find((t) => t.id === id)
  if (!victim) return undefined
  await write('Delete', { transactions: s.transactions.filter((t) => t.id !== id) }, (r) => r.deleteTransaction(id))
  return victim
}

export async function restoreTransaction(t: Transaction) {
  const s = useData.getState()
  if (s.transactions.some((x) => x.id === t.id)) return
  await write('Undo', { transactions: [...s.transactions, t] }, (r) => r.saveTransaction(t))
}

// ── Accounts ─────────────────────────────────────────────────────────

export async function saveAccount(a: Account) {
  const s = useData.getState()
  const next = { ...a, updatedAt: nowIso() }
  const exists = s.accounts.some((x) => x.id === a.id)
  const accounts = exists ? s.accounts.map((x) => (x.id === a.id ? next : x)) : [...s.accounts, next]
  await write('The account', { accounts }, (r) => r.saveAccount(next))
}

/** Deletes if unused, archives otherwise (history must keep its account). */
export async function removeAccount(id: string): Promise<'deleted' | 'archived'> {
  const s = useData.getState()
  const used =
    s.transactions.some((t) => t.accountId === id) || s.monthSettings.some((m) => m.adjustmentAccountId === id)
  if (used) {
    const a = s.accounts.find((x) => x.id === id)
    if (a) await saveAccount({ ...a, archived: true })
    return 'archived'
  }
  await write('Delete', { accounts: s.accounts.filter((a) => a.id !== id) }, (r) => r.deleteAccount(id))
  return 'deleted'
}

// ── Categories ────────────────────────────────────────────────────────

export async function saveCategory(c: Category) {
  const s = useData.getState()
  const next = { ...c, updatedAt: nowIso() }
  const exists = s.categories.some((x) => x.id === c.id)
  const categories = exists ? s.categories.map((x) => (x.id === c.id ? next : x)) : [...s.categories, next]
  await write('The category', { categories }, (r) => r.saveCategory(next))
}

export async function removeCategory(id: string): Promise<'deleted' | 'archived'> {
  const s = useData.getState()
  if (s.transactions.some((t) => t.categoryId === id)) {
    const c = s.categories.find((x) => x.id === id)
    if (c) await saveCategory({ ...c, archived: true })
    return 'archived'
  }
  await write('Delete', { categories: s.categories.filter((c) => c.id !== id) }, (r) => r.deleteCategory(id))
  return 'deleted'
}

// ── Month start adjustments ───────────────────────────────────────────

export async function setMonthAdjustment(month: MonthKey, amount: number, accountId: string | null) {
  const s = useData.getState()
  const rest = s.monthSettings.filter((m) => m.month !== month)
  if (amount === 0 || !accountId) {
    await write('The starting balance', { monthSettings: rest }, (r) => r.deleteMonthSetting(month))
    return
  }
  const setting: MonthSetting = { month, startAdjustment: amount, adjustmentAccountId: accountId, updatedAt: nowIso() }
  await write('The starting balance', { monthSettings: [...rest, setting] }, (r) => r.saveMonthSetting(setting))
}

// ── Profile & prefs ───────────────────────────────────────────────────

export async function updateProfile(patch: Partial<Profile>) {
  const profile = { ...useData.getState().profile, ...patch }
  await write('Settings', { profile }, (r) => r.saveProfile(profile))
}

export async function updatePrefs(patch: Partial<Prefs>) {
  const current = useData.getState().profile
  await updateProfile({ prefs: { ...current.prefs, ...patch } })
}

// ── Onboarding & resets ───────────────────────────────────────────────

export interface OnboardingInput {
  displayName: string
  mascotName: string
  startMonth: MonthKey
  balances: { bank: number; upi: number; cash: number }
}

export async function completeOnboarding(input: OnboardingInput) {
  if (!repo) throw new RepositoryError('Not signed in.')
  const snap: Snapshot = {
    transactions: [],
    monthSettings: [],
    accounts: buildDefaultAccounts(input.balances),
    categories: buildDefaultCategories(),
    profile: buildDefaultProfile({
      displayName: input.displayName.trim(),
      mascotName: input.mascotName.trim() || 'Khushi',
      startMonth: input.startMonth,
      trackingSince: todayKey(),
      onboarded: true,
      prefs: useData.getState().profile.prefs,
    }),
  }
  await repo.replaceAll(snap)
  if (repo.mode === 'local') writeLocalMeta({ demo: false })
  applySnapshot(snap, { demo: false })
  cacheSnapshot()
}

/** Local mode only: go back to the demo, or start from an empty slate. */
export async function resetLocal(to: 'demo' | 'fresh') {
  if (useData.getState().mode !== 'local') return
  LocalRepository.clear()
  const local = new LocalRepository()
  repo = local
  if (to === 'demo') {
    const { buildDemoSnapshot } = await import('../data/demo')
    const snap = buildDemoSnapshot()
    await local.replaceAll(snap)
    writeLocalMeta({ demo: true })
    applySnapshot(snap, { demo: true })
  } else {
    const snap = emptySnapshot()
    await local.replaceAll(snap)
    writeLocalMeta({ demo: false })
    useData.setState({ ...snap, status: 'onboarding', demo: false })
  }
}
