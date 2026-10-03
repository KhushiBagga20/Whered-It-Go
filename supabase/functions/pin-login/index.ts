// Supabase Edge Function entry (Deno). Deploy with JWT verification OFF —
// people calling it aren't signed in yet. See DEPLOYMENT.md.
//
//   npx supabase functions deploy pin-login --no-verify-jwt --project-ref <ref>
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// by the Edge runtime. Optional secrets:
//   ALLOWED_ORIGINS   comma-separated, e.g. "https://whered-it-go.vercel.app"
//   SERVICE_KEY / PUBLISHABLE_KEY   only if the project's legacy API keys are
//                     turned off: an sb_secret_… / sb_publishable_… key to use
//                     instead of the built-in ones.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handlePinLogin, type MinimalClient } from './handler.ts'

const env = (name: string) => Deno.env.get(name) ?? ''

Deno.serve((req) =>
  handlePinLogin(req, {
    url: env('SUPABASE_URL'),
    serviceKey: env('SERVICE_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'),
    anonKey: env('PUBLISHABLE_KEY') || env('SUPABASE_ANON_KEY'),
    allowedOrigins: env('ALLOWED_ORIGINS') || '*',
    createClient: (url, key, options) => createClient(url, key, options) as unknown as MinimalClient,
    log: (message, detail) => console.error(`[pin-login] ${message}`, detail ?? ''),
  }),
)
