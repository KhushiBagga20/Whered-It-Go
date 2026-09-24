import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined

/** Cloud mode is on when both env vars are present at build time. */
export const isCloudConfigured = Boolean(url && key)

let client: Promise<SupabaseClient> | null = null

/** Lazily loaded so local/demo mode never downloads the Supabase SDK. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!isCloudConfigured) return Promise.reject(new Error('Supabase is not configured'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  )
  return client
}
