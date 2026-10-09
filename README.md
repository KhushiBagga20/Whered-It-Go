# Where’dItGo — Love & Loss™

*Where your money goes to disappear beautifully.*

A small, private personal-finance PWA: money in, money out, the balance, where it went, when it happened — inside a purple-sky, neon-meadow world, supervised by a tiny illustrated Khushi who has opinions.

Two people use it: **🌻 Jais** tracks his money; **🌸 Khushi** watches, fixes things and leaves permanent notes. Each signs in with a 4-digit PIN. Deploying it: **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. With no Supabase keys the app runs **on-device** and loads **demo data** (August–September 2026: September starts at ₹8,000, +₹2,000 in, −₹2,430 out, ₹7,570 left). Pick Jais or Khushi and type any 4 digits to try either role; *Settings → Switch person* swaps. *Settings → Start for real* clears the demo and runs the two-question onboarding.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (also on your LAN: `--host` is on) |
| `npm run build` | Typecheck + production build + service worker |
| `npm run preview` | Serve the production build |
| `npm test` | Finance, mascot, RLS/PIN (real Postgres via PGlite) and pin-login tests (Vitest) |
| `npm run lint` | oxlint |
| `npm run icons` | Build every app icon in `public/icons/` from `icon-source/` ([docs/app-icon.md](docs/app-icon.md)) |

## Two people, one ledger

| | Jais (owner) | Khushi (observer) |
| --- | --- | --- |
| See everything | ✓ | ✓ |
| Add / delete transactions | ✓ | — |
| Edit transactions | ✓ | ✓ (*“Edited by Khushi · 9:03 PM”*) |
| Accounts, categories, month starts | ✓ | read-only |
| Permanent notes on transactions | reads them | writes them (no edit, no delete) |

Khushi gets her own home screen, **The evidence** (*Still got · Current damage · Came in*, the verdict, her notes), and an 👁 button that jumps to the latest transaction instead of **+**. Every change lands in an `activity_log` written by database triggers (the *Paper trail* on a transaction). Changes from the other phone arrive live (Supabase Realtime).

**Security lives in Postgres**, not the UI: Row Level Security policies + triggers (`supabase/migrations/20261002000000_two_person_ledger.sql`), tested against real Postgres in `supabase/tests/rls.test.ts`. PINs are bcrypt-hashed in a schema the API can’t reach and are only checked by the `pin-login` Edge Function, with an escalating lockout. Nothing secret is in the client.

## Turn on cloud sync (Supabase)

Everything — migrations, creating the two users, PINs, the Edge Function, Vercel — is in **[DEPLOYMENT.md](DEPLOYMENT.md)**. Short version: run the migrations, create two auth users, `select private.setup_ledger(...)`, `select private.set_pin(...)` ×2, deploy `pin-login` with `--no-verify-jwt`, put `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `.env.local` / Vercel.

Demo data never goes to Supabase. In cloud mode the last snapshot is cached on the device, so the app opens instantly and still reads offline; writes need a connection (a failed save rolls back and says why).

### Schema

`profiles`, `accounts`, `categories`, `transactions`, `monthly_settings`, plus `ledger_members` (who observes whose ledger), `transaction_comments` and `activity_log`. Composite foreign keys stop a transaction referencing another ledger’s category/account, a trigger stops income using a spending category, `created_by`/`updated_by` are stamped from the session (never the client), and a transaction can’t be moved to another ledger. No balances or totals are stored — they’re all derived.

## Put it on the Samsung phone

A PWA only installs from **HTTPS** (or `localhost`).

1. Deploy it (Vercel — see [DEPLOYMENT.md](DEPLOYMENT.md)).
2. Open the URL in Chrome or Samsung Internet → menu → **Install app / Add to Home screen**.
3. It launches standalone with the purple splash, and long-pressing the icon offers **Add evidence** (Jais) and **Calendar** shortcuts.

The layout follows the screen, not the device: the Galaxy Z Fold cover screen gets a one-handed single column (the equation folds into a 2×2); unfolded it gets a compact left rail and wider layouts (History shows the list and the selected transaction side by side); desktop gets the full side nav and a side panel. Content columns keep clear of the hinge on dual-screen devices (`horizontal-viewport-segments`).

## How the money works

Transactions are the only source of truth; everything else is computed in [`src/lib/finance.ts`](src/lib/finance.ts):

```
start(M)   = Σ account opening balances
           + Σ income before M − Σ spending before M
           + Σ start adjustments for months ≤ M
current(M) = start(M) + received(M) − spent(M)
```

So **rollover is automatic** (October starts with September’s ending), and editing or deleting any transaction moves every number — balances, account balances, the chart, the calendar, streaks — at once. Arithmetic runs in integer paise.

- **Accounts** hold an opening balance “as of the first tracked month”. Σ account balances always equals the dashboard’s *Still got*.
- **Fixing an account’s amount**: tap it on the Money page and type what’s really in it. The difference corrects the account’s opening balance, so it is never counted as income or spending (and it shifts earlier months by the same amount).
- **Adjusting a month’s start** (“September actually started with ₹8,300”) is booked against one account, so the dashboard and accounts keep agreeing. It isn’t counted as income or spending.
- Expenses that would take an account below zero get a warning and need a second tap.

## Code map

```
src/
  lib/          finance.ts (all money maths + monthly recap), money.ts, dates.ts,
                validation.ts, export.ts, supabase.ts, auth.ts (PIN sign-in), pwa.ts
  data/         types, defaults (categories/accounts/prefs), demo.ts (demo only),
                repository.ts + localRepo.ts + supabaseRepo.ts
  state/        store.ts (entities + optimistic writes), ui.ts (month, sheets,
                toasts, mascot), selectors.ts (derived-data hooks)
  mascot/       Mascot.tsx (the SVG character), reactions.ts (what she says, as
                data), engine.ts (picks a reaction), react.ts, MascotSpot.tsx, assets.ts
  components/   world/ (sky, hill, sun, flora), nav/, ui/ (Sheet, Button, …),
                SpendingChart, SpendingCalendar, TransactionComposer, …
  hooks/        useMedia (layout modes), useLedgerSync (realtime)
  pages/        Dashboard (Jais), ObserverDashboard (Khushi), CalendarPage,
                HistoryPage, MoneyPage, SettingsPage, AuthPage, Onboarding
  animations/   shared motion variants, burst particles
  styles/       tokens.css (the palette + scales + breakpoints), global.css
supabase/
  migrations/   init → tracking_since → two_person_ledger → bank_upi_one_account
  functions/    pin-login (Edge Function: PIN → session)
  tests/        RLS + PIN tests on PGlite
icon-source/    where the real app icon goes (docs/app-icon.md)
```

## Tiny Khushi

- **What she says** is data in [`src/mascot/reactions.ts`](src/mascot/reactions.ts) — a couple of hundred lines across moods (chill, suspicious, judging, concerned, proud, impressed, devastated, evil). Each rule has a trigger (expense, income, edit, delete, comment, month end, poke…), conditions over the context (amount, share of the month, category, same merchant again, streak, time of day, weekend, who did it), messages, a mood, a chance and a priority. Sometimes she just says “👁️👁️”. Reactions are never saved. *Settings → How judgy* doubles or halves the amount thresholds.
- **Where she is**: pages declare `<MascotSpot>`s (sitting on the donut, peeking over the calendar, over the composer, in empty states). Only the most recent one shows her, so she moves around rather than duplicating; otherwise she sits on the hill (or in the side panel on wide screens). Tap her for a comment.
- **Real artwork**: the character is a placeholder SVG until hand-drawn frames exist. Export them to [`src/assets/mascot/`](src/assets/mascot/) as `pose-face.webp` (e.g. `sit-judging.webp`) and they’re used automatically; missing faces fall back to the pose’s neutral drawing. The full list, canvas sizes and drawing templates are in [docs/tiny-khushi-art-brief.md](docs/tiny-khushi-art-brief.md); `/mascot` shows every pose × face in place.

## Notifications

None, on purpose (for now): no permission prompts, no push subscriptions, no reminders. Adding them later means a push server (an Edge Function on a schedule + Web Push); nothing else would need to change.

## Design notes

- Palette tokens live in [`src/styles/tokens.css`](src/styles/tokens.css): sky purples, neon grass, baby-pink petals, ember orange (anything pressable), sun yellow, plus paper/ink neutrals. Text colours are contrast-checked against the sky (≥ 4.5:1).
- The nine category colours were ordered to stay distinguishable for colour-blind readers when adjacent (checked with a CVD simulator), and the donut draws slices in that fixed order. The legend is the accessible table.
- Calendar days use shape + icon + amount, not just colour: sprout = no spending, the amount written on spend days (tinted by a one-hue ramp), a sun badge for money in.
- Ambient motion (grass, flowers, clouds, sun) only animates `transform`/`opacity` on small composited layers. *Settings → Motion* has Full / Calm / Still, and the OS “reduce motion” setting is always respected.
- Android back closes the top sheet before leaving a page.

## Not built (on purpose, or yet)

- Moving money between your own accounts (an ATM withdrawal, topping up a wallet). The brief defines only *Spent* and *Received*, so there’s no clean way to record a transfer yet; a “Move money” type that changes account balances without touching spending totals is the natural next feature.
- Offline write queue in cloud mode.
- Notifications (see above).
- Budgets, investments, bank sync — out of scope by design.
