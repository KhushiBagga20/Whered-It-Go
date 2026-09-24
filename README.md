# Where’dItGo — Love & Loss™

*Where your money goes to disappear beautifully.*

A small, private personal-finance PWA: money in, money out, the balance, where it went, when it happened — inside a purple-sky, neon-meadow world, supervised by a tiny illustrated Khushi who has opinions.

---

## Run it

```bash
npm install
npm run dev
```

Open the printed URL. With no Supabase keys the app runs **on-device** and loads **demo data** (August–September 2026, matching the brief: September starts at ₹8,000, +₹2,000 in, −₹2,430 out, ₹7,570 left). *Settings → Start for real* clears the demo and runs the two-question onboarding.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (also on your LAN: `--host` is on) |
| `npm run build` | Typecheck + production build + service worker |
| `npm run preview` | Serve the production build |
| `npm test` | Finance, validation, mascot and nudge tests (Vitest) |
| `npm run lint` | oxlint |
| `npm run icons` | Regenerate every app icon from `public/favicon.svg` + `public/icon-fullbleed.svg` |

## Turn on cloud sync (Supabase)

1. Create a Supabase project.
2. Run `supabase/migrations/20260923000000_init.sql` — paste it into **SQL Editor → Run**, or `supabase db push` with the CLI. It is idempotent.
3. If your project was created from an earlier copy of the init migration, also run `supabase/migrations/20260924000000_profiles_tracking_since.sql` (safe to run regardless).
4. **Authentication → URL configuration**: set *Site URL* to your deployed URL (and add `http://localhost:5173` to redirect URLs for dev). Email + password and magic links both work; turn off “Confirm email” if you want to skip the confirmation step.
5. Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the public anon/publishable key — never the service-role key).
6. Restart `npm run dev`. The app now asks you to sign in, then onboards you.

Demo data never goes to Supabase. In cloud mode the last snapshot is cached on the device, so the app opens instantly and still reads offline; writes need a connection (a failed save rolls back and says why).

### Schema

`profiles`, `accounts`, `categories`, `transactions`, `monthly_settings`. Every table has Row Level Security (`auth.uid() = user_id`), composite foreign keys so a transaction can’t reference someone else’s category/account, a trigger that stops an income transaction using a spending category, and `amount > 0` checks. No balances or totals are stored — they’re all derived.

The migration was checked against real Postgres (PGlite) with a stubbed `auth` schema: applies twice cleanly, auto-creates profiles on sign-up, isolates users, and rejects negative amounts, mismatched categories, deleting categories still in use, and anonymous access.

## Put it on the Samsung phone

A PWA only installs from **HTTPS** (or `localhost`).

1. Deploy the build anywhere static: Vercel (`vercel.json` included) or Netlify (`public/_redirects` included). `npm run build` → `dist/`. On Vercel: framework *Vite*, and add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` under *Settings → Environment Variables* — they’re baked in at build time, so redeploy after changing them.
2. Open the URL in Chrome or Samsung Internet → menu → **Install app / Add to Home screen**.
3. It launches standalone with the purple splash, and long-pressing the icon offers **Add evidence** and **Calendar** shortcuts.

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
- **Adjusting a month’s start** (“September actually started with ₹8,300”) is booked against one account, so the dashboard and accounts keep agreeing. It isn’t counted as income or spending.
- Expenses that would take an account below zero get a warning and need a second tap.

## Code map

```
src/
  lib/          finance.ts (all money maths), money.ts, dates.ts, validation.ts,
                notifications.ts, export.ts, supabase.ts, auth.ts, sheetHistory.ts
  data/         types, defaults (categories/accounts/prefs), demo.ts (demo only),
                repository.ts + localRepo.ts + supabaseRepo.ts
  state/        store.ts (entities + optimistic writes), ui.ts (month, sheets,
                toasts, mascot), selectors.ts (derived-data hooks)
  mascot/       Mascot.tsx (the SVG character), reactions.ts (what she says, as
                data), engine.ts (picks a reaction), react.ts, MascotSpot.tsx, assets.ts
  components/   world/ (sky, hill, sun, flora), nav/, ui/ (Sheet, Button, …),
                SpendingChart, SpendingCalendar, TransactionComposer, …
  pages/        Dashboard, CalendarPage, HistoryPage, MoneyPage, SettingsPage,
                AuthPage, Onboarding
  animations/   shared motion variants, burst particles
  styles/       tokens.css (the palette + scales), global.css
```

## Tiny Khushi

- **What she says** is data in [`src/mascot/reactions.ts`](src/mascot/reactions.ts): trigger, conditions (amount range, category, repeat count, streak, hour), messages, expression, animation, priority. Add a rule to add a reaction. *Settings → How judgy* doubles or halves the amount thresholds.
- **Where she is**: pages declare `<MascotSpot>`s (sitting on the donut, peeking over the calendar, over the composer, in empty states). Only the most recent one shows her, so she moves around rather than duplicating; otherwise she sits on the hill (or in the side panel on wide screens). Tap her for a comment.
- **Real artwork**: the character is a placeholder SVG until hand-drawn frames exist. Export them to [`src/assets/mascot/`](src/assets/mascot/) as `pose-face.webp` (e.g. `sit-judging.webp`) and they’re used automatically; missing faces fall back to the pose’s neutral drawing. The full list, canvas sizes and drawing templates are in [docs/tiny-khushi-art-brief.md](docs/tiny-khushi-art-brief.md); `/mascot` shows every pose × face in place.

## Notifications

Settings → *Nudges*: permission, an evening check-in (“yo where ur money go?”), a big-day alert, and a no-spend celebration, each at most once a day, plus a test button. The logic is `evaluateNudges()` (pure, tested) → `NUDGE_LINES` (data) → `deliver()` (service-worker notification).

**Limitation:** these fire while the app is open or still alive in the background. Reminders when the app is fully closed need a push server — the next step is a Supabase Edge Function on a cron that evaluates the same rules and sends Web Push (VAPID). Nothing else in the app needs to change for that.

## Design notes

- Palette tokens live in [`src/styles/tokens.css`](src/styles/tokens.css): sky purples, neon grass, baby-pink petals, ember orange (anything pressable), sun yellow, plus paper/ink neutrals. Text colours are contrast-checked against the sky (≥ 4.5:1).
- The nine category colours were ordered to stay distinguishable for colour-blind readers when adjacent (checked with a CVD simulator), and the donut draws slices in that fixed order. The legend is the accessible table.
- Calendar days use shape + icon + amount, not just colour: sprout = no spending, the amount written on spend days (tinted by a one-hue ramp), a sun badge for money in.
- Ambient motion (grass, flowers, clouds, sun) only animates `transform`/`opacity` on small composited layers. *Settings → Motion* has Full / Calm / Still, and the OS “reduce motion” setting is always respected.
- Android back closes the top sheet before leaving a page.

## Not built (on purpose, or yet)

- Moving money between your own accounts (an ATM withdrawal, topping up a wallet). The brief defines only *Spent* and *Received*, so there’s no clean way to record a transfer yet; a “Move money” type that changes account balances without touching spending totals is the natural next feature.
- Offline write queue in cloud mode.
- Background push (see Notifications).
- Budgets, investments, bank sync — out of scope by design.
