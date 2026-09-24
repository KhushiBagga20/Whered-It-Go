import { withPrefDefaults } from './defaults'
import { RepositoryError, type Repository } from './repository'
import type { Snapshot } from './types'

const KEY = 'wig:local:v1'
const META_KEY = 'wig:local:meta'

export interface LocalMeta {
  /** True while the device is showing the bundled demo, not real data. */
  demo: boolean
}

function read(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Snapshot
    parsed.profile.prefs = withPrefDefaults(parsed.profile.prefs)
    return parsed
  } catch {
    return null
  }
}

export function readLocalMeta(): LocalMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? (JSON.parse(raw) as LocalMeta) : { demo: false }
  } catch {
    return { demo: false }
  }
}

export function writeLocalMeta(meta: LocalMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // storage full/blocked: meta is cosmetic, ignore
  }
}

/**
 * On-device repository. Keeps one snapshot in memory and writes it back
 * to localStorage after every change. Used when Supabase isn't configured,
 * and for the demo.
 */
export class LocalRepository implements Repository {
  readonly mode = 'local' as const
  private snap: Snapshot | null = read()

  async load() {
    this.snap = read()
    return this.snap ? structuredClone(this.snap) : null
  }

  private commit(mutate: (s: Snapshot) => void) {
    if (!this.snap) throw new RepositoryError('Nothing to save into yet.')
    mutate(this.snap)
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snap))
    } catch (e) {
      throw new RepositoryError('Couldn’t save to this device’s storage.', e instanceof Error ? e.message : String(e))
    }
  }

  private upsert<T extends { id: string }>(list: T[], item: T) {
    const i = list.findIndex((x) => x.id === item.id)
    if (i === -1) list.push(item)
    else list[i] = item
  }

  async saveTransaction(t: Snapshot['transactions'][number]) {
    this.commit((s) => this.upsert(s.transactions, t))
  }
  async deleteTransaction(id: string) {
    this.commit((s) => {
      s.transactions = s.transactions.filter((t) => t.id !== id)
    })
  }
  async saveAccount(a: Snapshot['accounts'][number]) {
    this.commit((s) => this.upsert(s.accounts, a))
  }
  async deleteAccount(id: string) {
    this.commit((s) => {
      s.accounts = s.accounts.filter((a) => a.id !== id)
    })
  }
  async saveCategory(c: Snapshot['categories'][number]) {
    this.commit((s) => this.upsert(s.categories, c))
  }
  async deleteCategory(id: string) {
    this.commit((s) => {
      s.categories = s.categories.filter((c) => c.id !== id)
    })
  }
  async saveMonthSetting(m: Snapshot['monthSettings'][number]) {
    this.commit((s) => {
      const i = s.monthSettings.findIndex((x) => x.month === m.month)
      if (i === -1) s.monthSettings.push(m)
      else s.monthSettings[i] = m
    })
  }
  async deleteMonthSetting(month: string) {
    this.commit((s) => {
      s.monthSettings = s.monthSettings.filter((m) => m.month !== month)
    })
  }
  async saveProfile(p: Snapshot['profile']) {
    this.commit((s) => {
      s.profile = p
    })
  }
  async replaceAll(next: Snapshot) {
    this.snap = structuredClone(next)
    this.commit(() => {})
  }

  /** Wipe everything on this device (Settings → reset). */
  static clear() {
    localStorage.removeItem(KEY)
    localStorage.removeItem(META_KEY)
  }
}
