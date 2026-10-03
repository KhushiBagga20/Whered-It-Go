import { create } from 'zustand'
import { buildDefaultAccounts, buildDefaultCategories, buildDefaultProfile, withPrefDefaults } from '../data/defaults'
import { LOCAL_MEMBERS, LocalRepository, readLocalMeta, readLocalViewer, writeLocalMeta, writeLocalViewer } from '../data/localRepo'
import { RepositoryError, type Repository } from '../data/repository'
import type {
  Account,
  ActivityEntry,
  Category,
  Member,
  MonthKey,
  MonthSetting,
  Person,
  Prefs,
  Profile,
  Snapshot,
  Transaction,
  TransactionComment,
  TransactionDraft,
} from '../data/types'
import { rememberPerson } from '../lib/auth'
import { currentMonthKey, todayKey } from '../lib/dates'
import { newId, nowIso } from '../lib/id'
import { isCloudConfigured } from '../lib/supabase'
import { ui } from './ui'

/**
 * signed-out  → the "who are you?" screen
 * onboarding  → Jais sets up the ledger (first run)
 * waiting     → Khushi signed in before Jais set anything up
 */
export type BootStatus = 'booting' | 'signed-out' | 'onboarding' | 'waiting' | 'ready' | 'error'

interface DataState extends Snapshot {
  status: BootStatus
  mode: 'local' | 'cloud'
  demo: boolean
  email: string | null
  /** The person using the app right now. */
  viewer: Member | null
  /** Jais's id: whose ledger this is. */
  ownerId: string | null
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
  comments: [],
  members: [],
})

export const useData = create<DataState>(() => ({
  ...emptySnapshot(),
  status: 'booting',
  mode: isCloudConfigured ? 'cloud' : 'local',
  demo: false,
  email: null,
  viewer: null,
  ownerId: null,
  pending: 0,
  bootError: null,
}))

let repo: Repository | null = null
const CACHE_PREFIX = 'wig:cache:v2:'

function snapshotOf(s: DataState): Snapshot {
  return {
    transactions: s.transactions,
    accounts: s.accounts,
    categories: s.categories,
    monthSettings: s.monthSettings,
    profile: s.profile,
    comments: s.comments,
    members: s.members,
  }
}

/** Cloud mode keeps a copy on the device so the app opens instantly (and offline). */
function cacheSnapshot() {
  const s = useData.getState()
  if (s.mode !== 'cloud' || !s.viewer) return
  try {
    localStorage.setItem(CACHE_PREFIX + s.viewer.id, JSON.stringify(snapshotOf(s)))
  } catch {
    // cache is best-effort
  }
}

function readCache(userId: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId)
    if (!raw) return null
    const snap = JSON.parse(raw) as Snapshot
    snap.profile.prefs = withPrefDefaults(snap.profile.prefs)
    return snap
  } catch {
    return null
  }
}

function statusFor(snap: Snapshot, viewer: Member): BootStatus {
  if (snap.profile.onboarded) return 'ready'
  return viewer.role === 'owner' ? 'onboarding' : 'waiting'
}

function applySnapshot(snap: Snapshot, extra: Partial<DataState> = {}, { keepMonth = false } = {}) {
  const viewer = extra.viewer ?? useData.getState().viewer
  useData.setState({
    ...snap,
    profile: { ...snap.profile, prefs: withPrefDefaults(snap.profile.prefs) },
    status: viewer ? statusFor(snap, viewer) : 'signed-out',
    bootError: null,
    ...extra,
  })
  if (!keepMonth) ui.setMonth(currentMonthKey())
}

function describe(e: unknown): { message: string; detail?: string } {
  if (e instanceof RepositoryError) return { message: e.message, detail: e.detail }
  if (e instanceof Error) return { message: 'Something broke.', detail: e.message }
  return { message: 'Something broke.', detail: String(e) }
}

/** Who's signed in (UX only — the database enforces the real rules). */
export const isObserver = () => useData.getState().viewer?.role === 'observer'
ui.setCreateGuard(() => !isObserver())

// ── Boot ───────────────────────────────────────────────────────────────

export async function boot(): Promise<void> {
  useData.setState({ status: 'booting', bootError: null })
  try {
    if (!isCloudConfigured) {
      const person = readLocalViewer()
      if (!person) {
        useData.setState({ status: 'signed-out', mode: 'local' })
        return
      }
      await bootLocal(person)
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

async function bootLocal(person: Person) {
  const local = new LocalRepository(person)
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
  applySnapshot(snap, { mode: 'local', demo, email: null, viewer: local.session.viewer, ownerId: local.session.ownerId })
}

/** On-device mode: pick which of the two people you are (no real security here). */
export async function signInLocal(person: Person) {
  writeLocalViewer(person)
  useData.setState({ status: 'booting' })
  await bootLocal(person)
}

export async function bootCloud(userId: string, email: string) {
  const [{ getSupabase }, { SupabaseRepository }] = await Promise.all([
    import('../lib/supabase'),
    import('../data/supabaseRepo'),
  ])
  const sb = await getSupabase()
  const cloud = await SupabaseRepository.open(sb, userId)
  repo = cloud
  const base = { mode: 'cloud' as const, email, demo: false, viewer: cloud.session.viewer, ownerId: cloud.session.ownerId }
  useData.setState(base)

  const cached = readCache(userId)
  if (cached) applySnapshot(cached, base)

  try {
    const fresh = await cloud.load()
    if (fresh) {
      applySnapshot(fresh, base)
      cacheSnapshot()
    } else {
      useData.setState({
        ...emptySnapshot(),
        ...base,
        status: cloud.session.viewer.role === 'owner' ? 'onboarding' : 'waiting',
      })
    }
  } catch (e) {
    // Offline with a cache: keep going on cached data and say so.
    if (cached) ui.toast('Showing saved data — couldn’t reach the server.', { tone: 'error', detail: describe(e).detail })
    else throw e
  }
}

/** Quietly re-read everything (coming back to the app, or after a realtime hiccup). */
export async function refresh() {
  const s = useData.getState()
  if (!repo || s.status !== 'ready' || s.pending > 0) return
  try {
    const fresh = await repo.load()
    if (fresh && useData.getState().pending === 0) {
      applySnapshot(fresh, {}, { keepMonth: true })
      cacheSnapshot()
    }
  } catch {
    // stay on what we have; the next refresh will try again
  }
}

export async function signOut() {
  const s = useData.getState()
  if (s.mode === 'cloud') {
    const { getSupabase } = await import('../lib/supabase')
    const sb = await getSupabase()
    // only this device: signing out on the phone shouldn't sign him out everywhere
    await sb.auth.signOut({ scope: 'local' })
    if (s.viewer) localStorage.removeItem(CACHE_PREFIX + s.viewer.id)
  } else {
    writeLocalViewer(null)
  }
  rememberPerson(null)
  repo = null
  useData.setState({ ...emptySnapshot(), status: 'signed-out', email: null, viewer: null, ownerId: null })
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

function ownerOnly(what: string) {
  if (isObserver()) {
    ui.toast(`Only Jais can ${what}. You can edit and leave notes.`, { tone: 'error' })
    throw new RepositoryError(`Only Jais can ${what}.`)
  }
}

// ── Transactions ──────────────────────────────────────────────────────

export async function saveTransaction(draft: TransactionDraft): Promise<{ tx: Transaction; created: boolean }> {
  const s = useData.getState()
  const existing = draft.id ? s.transactions.find((t) => t.id === draft.id) : undefined
  if (!existing) ownerOnly('add transactions')
  const ts = nowIso()
  const me = s.viewer?.id ?? null
  const tx: Transaction = {
    ...draft,
    description: draft.description.trim(),
    note: draft.note?.trim() ? draft.note.trim() : null,
    id: existing?.id ?? draft.id ?? newId(),
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
    createdBy: existing?.createdBy ?? me,
    updatedBy: me,
  }
  const transactions = existing ? s.transactions.map((t) => (t.id === tx.id ? tx : t)) : [...s.transactions, tx]
  await write('That', { transactions }, (r) => (existing ? r.updateTransaction(tx) : r.insertTransaction(tx)))
  return { tx, created: !existing }
}

export async function deleteTransaction(id: string): Promise<Transaction | undefined> {
  ownerOnly('delete transactions')
  const s = useData.getState()
  const victim = s.transactions.find((t) => t.id === id)
  if (!victim) return undefined
  await write(
    'Delete',
    { transactions: s.transactions.filter((t) => t.id !== id), comments: s.comments.filter((c) => c.transactionId !== id) },
    (r) => r.deleteTransaction(id),
  )
  return victim
}

/** Undo a delete. Khushi's notes on it don't come back — they went with it. */
export async function restoreTransaction(t: Transaction) {
  const s = useData.getState()
  if (s.transactions.some((x) => x.id === t.id)) return
  await write('Undo', { transactions: [...s.transactions, t] }, (r) => r.insertTransaction(t))
}

// ── Khushi's notes & the paper trail ───────────────────────────────────

export async function addComment(transactionId: string, text: string): Promise<TransactionComment> {
  const s = useData.getState()
  if (!s.viewer || s.viewer.role !== 'observer') throw new RepositoryError('Only Khushi leaves notes.')
  const comment: TransactionComment = {
    id: newId(),
    transactionId,
    authorId: s.viewer.id,
    comment: text.trim(),
    createdAt: nowIso(),
  }
  await write('Your note', { comments: [...s.comments, comment] }, (r) => r.addComment(comment))
  return comment
}

export async function loadActivity(transactionId: string): Promise<ActivityEntry[]> {
  if (!repo) return []
  return repo.activityFor(transactionId)
}

// ── Live changes from the other person (cloud realtime) ───────────────

export function applyRemoteTransaction(tx: Transaction) {
  useData.setState((s) => {
    const i = s.transactions.findIndex((t) => t.id === tx.id)
    if (i !== -1 && s.transactions[i].updatedAt >= tx.updatedAt) return {}
    const transactions = i === -1 ? [...s.transactions, tx] : s.transactions.map((t) => (t.id === tx.id ? tx : t))
    return { transactions }
  })
  cacheSnapshot()
}

export function applyRemoteDelete(id: string) {
  useData.setState((s) => ({
    transactions: s.transactions.filter((t) => t.id !== id),
    comments: s.comments.filter((c) => c.transactionId !== id),
  }))
  cacheSnapshot()
}

/** Returns true if it was new to us. */
export function applyRemoteComment(c: TransactionComment): boolean {
  if (useData.getState().comments.some((x) => x.id === c.id)) return false
  useData.setState((s) => ({ comments: [...s.comments, c] }))
  cacheSnapshot()
  return true
}

// ── Accounts ─────────────────────────────────────────────────────────

export async function saveAccount(a: Account) {
  ownerOnly('manage accounts')
  const s = useData.getState()
  const next = { ...a, updatedAt: nowIso() }
  const exists = s.accounts.some((x) => x.id === a.id)
  const accounts = exists ? s.accounts.map((x) => (x.id === a.id ? next : x)) : [...s.accounts, next]
  await write('The account', { accounts }, (r) => r.saveAccount(next))
}

/** Deletes if unused, archives otherwise (history must keep its account). */
export async function removeAccount(id: string): Promise<'deleted' | 'archived'> {
  ownerOnly('manage accounts')
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
  ownerOnly('manage categories')
  const s = useData.getState()
  const next = { ...c, updatedAt: nowIso() }
  const exists = s.categories.some((x) => x.id === c.id)
  const categories = exists ? s.categories.map((x) => (x.id === c.id ? next : x)) : [...s.categories, next]
  await write('The category', { categories }, (r) => r.saveCategory(next))
}

export async function removeCategory(id: string): Promise<'deleted' | 'archived'> {
  ownerOnly('manage categories')
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
  ownerOnly('change starting balances')
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

/** Ledger-level settings (names, start month) — Jais's. */
export async function updateProfile(patch: Partial<Profile>) {
  ownerOnly('change those settings')
  const profile = { ...useData.getState().profile, ...patch }
  await write('Settings', { profile }, (r) => r.saveProfile(profile))
}

/** Personal prefs (motion, mascot) — everyone has their own. */
export async function updatePrefs(patch: Partial<Prefs>) {
  const current = useData.getState().profile
  const profile = { ...current, prefs: { ...current.prefs, ...patch } }
  await write('Settings', { profile }, (r) => r.saveProfile(profile))
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
  const s = useData.getState()
  const snap: Snapshot = {
    transactions: [],
    monthSettings: [],
    comments: [],
    members: s.members.length ? s.members : s.viewer ? [s.viewer] : [],
    accounts: buildDefaultAccounts(input.balances),
    categories: buildDefaultCategories(),
    profile: buildDefaultProfile({
      displayName: input.displayName.trim(),
      mascotName: input.mascotName.trim() || 'Khushi',
      startMonth: input.startMonth,
      trackingSince: todayKey(),
      onboarded: true,
      prefs: s.profile.prefs,
    }),
  }
  await repo.replaceAll(snap)
  if (repo.mode === 'local') writeLocalMeta({ demo: false })
  applySnapshot(snap, { demo: false, members: repo.mode === 'local' ? LOCAL_MEMBERS : snap.members })
  cacheSnapshot()
}

/** Local mode only: go back to the demo, or start from an empty slate. */
export async function resetLocal(to: 'demo' | 'fresh') {
  const s = useData.getState()
  if (s.mode !== 'local') return
  const person = s.viewer?.person ?? 'jais'
  LocalRepository.clear()
  const local = new LocalRepository(person)
  repo = local
  if (to === 'demo') {
    const { buildDemoSnapshot } = await import('../data/demo')
    const snap = buildDemoSnapshot()
    await local.replaceAll(snap)
    writeLocalMeta({ demo: true })
    applySnapshot(snap, { demo: true, viewer: local.session.viewer, ownerId: local.session.ownerId })
  } else {
    const snap = { ...emptySnapshot(), members: LOCAL_MEMBERS }
    await local.replaceAll(snap)
    writeLocalMeta({ demo: false })
    useData.setState({
      ...snap,
      status: local.session.viewer.role === 'owner' ? 'onboarding' : 'waiting',
      demo: false,
      viewer: local.session.viewer,
      ownerId: local.session.ownerId,
    })
  }
}
