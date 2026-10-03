# Deploying Where’dItGo

Two people, one ledger:

| | Can | Can’t |
| --- | --- | --- |
| 🌻 **Jais** (owner) | everything: add, edit, delete transactions; manage accounts, categories, month starts | — |
| 🌸 **Khushi** (observer) | see everything, edit existing transactions, leave permanent notes | add or delete transactions; add/edit/delete accounts or categories; edit or delete notes |

Postgres enforces all of this through Row Level Security and triggers. The app’s role checks only decide which buttons to show.

**Order matters.** Vercel deploys `main` automatically, and the new app expects the new database. Do steps 1–5 **before** pushing the code (step 6).

---

## 1. Supabase: run the migrations

Supabase dashboard → **SQL Editor** → paste each file → **Run**, in this order:

1. `supabase/migrations/20260923000000_init.sql`
2. `supabase/migrations/20260924000000_profiles_tracking_since.sql`
3. `supabase/migrations/20261002000000_two_person_ledger.sql`

All three can safely be run more than once. If the first two already ran when you set the database up, run them again anyway or skip them; either is fine.

With the CLI instead:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Migration 3 adds:
- the ledger link (`ledger_members`);
- `created_by` / `updated_by` on transactions;
- Khushi’s notes (`transaction_comments`) and the `activity_log`;
- the PIN tables;
- the new RLS policies.

It also adds `transactions` and `transaction_comments` to Realtime, so notes and edits show up live on the other phone.

## 2. Create the two people

**Authentication → Users → Add user → Create new user**, twice:

- Jais: his email and a **long random password** (a password manager is ideal), with **Auto Confirm User** ticked.
- Khushi: the same, with her email.

These passwords are the backup way in ("Trouble? Sign in with email"). Day to day they never need typing.

> **Already used the first version?** Use the account that holds the existing data as **Jais’s** account. Transactions stay with the user who created them, so that account becomes the shared ledger. Data entered under Khushi’s own account isn’t shown in the two-person app.

Then turn sign-ups off. Under **Authentication → Sign In / Providers**, switch off **Allow new users to sign up**. Nobody else needs an account.

## 3. Link them and set the PINs

In the SQL Editor (replace the emails and PINs):

```sql
select private.setup_ledger('jais@example.com', 'khushi@example.com');
select private.set_pin('jais',   '<4 digits>');
select private.set_pin('khushi', '<4 digits>');
```

- `setup_ledger` makes Jais the owner and Khushi the observer. It is safe to re-run.
- `set_pin` stores only a bcrypt hash, in a `private` schema the API can’t reach.
  - The SQL editor keeps a history of what you ran. Delete those entries afterwards, or change the PINs from inside the app (Settings → Change PIN).
  - Avoid `1234`, birthdays and anniversaries.
- If someone gets locked out: `select private.unlock_pin('jais');`

**Lockout:** 5 free wrong guesses, then 5 minutes. Each further miss doubles that, up to 24 hours. A day with no misses resets the count.

## 4. Deploy the `pin-login` Edge Function

This function checks a PIN and, if it’s right, hands back a normal Supabase session. It has to run **without JWT verification**, because whoever calls it isn’t signed in yet.

```bash
npx supabase login
npx supabase functions deploy pin-login --no-verify-jwt --project-ref <your-project-ref>
```

(`supabase/config.toml` sets `verify_jwt = false` too.)

The Edge runtime provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` automatically, so **no service key ever goes into the app or into Vercel**.

Optional: restrict which sites may call it. Use your real Vercel URL, and include `localhost` only if you sign in from the dev server:

```bash
npx supabase secrets set ALLOWED_ORIGINS="https://<your-app>.vercel.app,http://localhost:5173" --project-ref <your-project-ref>
```

**Without the CLI:** Dashboard → **Edge Functions** → *Deploy a new function* → name it `pin-login`. Paste `handler.ts` and `index.ts` as two files. Then go to the function’s *Details* and turn **Verify JWT** off.

## 5. Auth URL settings

**Authentication → URL Configuration**:
- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs:** add `http://localhost:5173`

Sessions persist: each phone stays signed in (the refresh token rotates automatically) until someone taps **Log out**.

## 6. Vercel

1. Import the GitHub repo. *Framework preset:* **Vite**. Build command and output directory come from `vercel.json` (`npm run build` → `dist`).
2. Under **Settings → Environment Variables**, add the variables below for **Production**, and for **Preview** too if you want preview deploys to work.

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` (Project Settings → API) |
   | `VITE_SUPABASE_ANON_KEY` | the **anon / publishable** key (never the service-role key) |

   These are compiled into the build, so **redeploy after changing them**. Preview deploys use the same database.
3. Push to `main` (or click **Redeploy**).

`vercel.json` also:
- sends every non-file URL to `index.html`, so `/history` and `/calendar` survive a refresh;
- serves `sw.js` and the manifest with `no-cache`, so updates arrive;
- caches hashed assets for a year;
- adds a strict Content-Security-Policy and other security headers.

The CSP allows `https://*.supabase.co` and `wss://*.supabase.co`. **If you ever put Supabase behind a custom domain, add it to `connect-src` in `vercel.json`.**

## 7. Install on the phones

Open the Vercel URL in Chrome or Samsung Internet, then use the menu → **Install app** (or **Add to Home screen**). Each of you picks yourself (🌻 / 🌸) and enters your PIN once.

When a new version is deployed, the app shows *“A fresh version of the meadow is ready.”* the next time it’s opened. The message stays on screen (on the login screen too) until you tap **Reload**.

## Check it worked

- Jais logs in: he gets the normal dashboard with the **+** button.
- Khushi logs in: she gets **The evidence** dashboard, with an 👁 button instead of +. In her view:
  - she can add a note to any transaction;
  - she can edit a transaction, and Jais then sees *Edited by Khushi · time*;
  - there’s no Delete.
- A wrong PIN shows “Not it. N tries before a timeout.”

## If PIN login doesn’t work

| What you see | Why / fix |
| --- | --- |
| “No PIN set for this person yet” | Run `private.setup_ledger(...)` and `private.set_pin(...)` (step 3). |
| “Couldn’t check the PIN right now” | The function isn’t deployed, or JWT verification is still on. Redeploy with `--no-verify-jwt`. Check **Edge Functions → pin-login → Logs** too. |
| Function logs mention invalid API key / JWT | The project’s *legacy* API keys are turned off. Set `SERVICE_KEY` (an `sb_secret_…` key) and `PUBLISHABLE_KEY` (the `sb_publishable_…` key) with `npx supabase secrets set … --project-ref <ref>`, or turn the legacy keys back on. |
| “Too many wrong PINs” | Wait it out, or run `select private.unlock_pin('jais');` |
| The app says *permission* / *not allowed* | Usually a missing migration. Run migration 3 again; it’s safe to repeat. |

The email + password fallback (“Trouble? Sign in with email”) always works, even while the function is down.

---

## Local development

```bash
cp .env.example .env.local   # fill in the two VITE_ values
npm install
npm run dev                  # http://localhost:5173
```

- **Empty `.env.local`, or no file:** the app runs on-device with demo data. Any 4 digits get you in as either person, so you can try both roles. Nothing leaves the browser.
- **Filled in:** it talks to your real Supabase project, using the deployed `pin-login` function. Be careful: that’s real data.

Checks:

```bash
npm run typecheck
npm run lint
npm test          # includes RLS + PIN tests against a real Postgres (PGlite), no Docker needed
npm run build
```

`supabase/tests/rls.test.ts` runs all three migrations against an in-memory Postgres and proves the permission table above: Khushi can’t insert, delete, move or manage anything, nobody can edit notes, strangers and anonymous callers see nothing, and the PIN lockout works.

## Environment variables, all of them

| Where | Name | Secret? |
| --- | --- | --- |
| `.env.local` / Vercel | `VITE_SUPABASE_URL` | no (public) |
| `.env.local` / Vercel | `VITE_SUPABASE_ANON_KEY` | no (public; RLS protects the data) |
| Supabase Edge secrets (automatic) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **service role: yes**. It lives only in Supabase. |
| Supabase Edge secrets (optional) | `ALLOWED_ORIGINS` | no |
| Supabase Edge secrets (only if legacy keys are off) | `SERVICE_KEY`, `PUBLISHABLE_KEY` | **`SERVICE_KEY`: yes** |

## The app icon

The icon lives at `icon-source/icon.png`; every size the app uses is built from it into `public/icons/`. To change it:

1. Replace `icon-source/icon.png` (1024×1024, square).
2. Run `npm run icons`.
3. If the background colour changed, put the new one in `background_color` in `vite.config.ts` (the script prints it).
4. Commit and push.

Full details are in [docs/app-icon.md](docs/app-icon.md).
