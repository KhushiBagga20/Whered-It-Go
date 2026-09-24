-- ─────────────────────────────────────────────────────────────────────
-- Where'dItGo — initial schema
--
-- Transactions are the source of truth. No balances or totals are
-- stored anywhere; the app derives them. Every row belongs to exactly
-- one auth user and Row Level Security keeps it that way.
-- ─────────────────────────────────────────────────────────────────────

-- gen_random_uuid() is built into Postgres 13+, no extension needed.

-- updated_at bookkeeping ------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  mascot_name  text not null default 'Khushi' check (char_length(mascot_name) between 1 and 24),
  start_month  text not null default to_char(now(), 'YYYY-MM')
               check (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- the day logging began; earlier days don't count as "no-spend"
  tracking_since date,
  onboarded    boolean not null default false,
  prefs        jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- accounts: where money sits ---------------------------------------------
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 24),
  kind            text not null check (kind in ('bank', 'upi', 'cash', 'card', 'wallet', 'other')),
  -- balance as of the first day of profiles.start_month
  opening_balance numeric(12, 2) not null default 0,
  color           smallint not null default 0 check (color between 0 and 9),
  sort_order      integer not null default 0,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id)
);

-- categories -------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key        text, -- stable key for built-ins ('food'…); null for custom
  name       text not null check (char_length(name) between 1 and 24),
  kind       text not null check (kind in ('expense', 'income')),
  icon       text not null default 'shapes',
  color      smallint not null default 0 check (color between 0 and 9),
  sort_order integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

-- transactions: the source of truth ---------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null check (type in ('expense', 'income')),
  amount      numeric(12, 2) not null check (amount > 0 and amount <= 10000000),
  category_id uuid not null,
  description text not null default '' check (char_length(description) <= 80),
  account_id  uuid not null,
  date        date not null,
  time        time not null,
  note        text check (note is null or char_length(note) <= 280),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- composite keys make it impossible to point at someone else's category/account
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete restrict,
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete restrict
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, time desc);
create index if not exists transactions_category_idx on public.transactions (category_id);
create index if not exists transactions_account_idx on public.transactions (account_id);

-- monthly_settings: manual tweaks to a month's rolled-over start ------------
create table if not exists public.monthly_settings (
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month                 text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  start_adjustment      numeric(12, 2) not null default 0,
  adjustment_account_id uuid,
  updated_at            timestamptz not null default now(),
  primary key (user_id, month),
  foreign key (adjustment_account_id, user_id) references public.accounts (id, user_id) on delete restrict,
  check (start_adjustment = 0 or adjustment_account_id is not null)
);

-- A spending transaction must use a spending category (and vice versa).
create or replace function public.check_transaction_category_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cat_kind text;
begin
  select kind into cat_kind from public.categories where id = new.category_id;
  if cat_kind is distinct from new.type then
    raise exception 'category kind (%) does not match transaction type (%)', cat_kind, new.type
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_category_kind on public.transactions;
create trigger transactions_category_kind
  before insert or update of category_id, type on public.transactions
  for each row execute function public.check_transaction_category_kind();

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['profiles', 'accounts', 'categories', 'transactions', 'monthly_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()',
      t, t);
  end loop;
end;
$$;

-- New sign-ups get an empty profile; the app onboards them from there.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security: private by default ────────────────────────────
alter table public.profiles         enable row level security;
alter table public.accounts         enable row level security;
alter table public.categories       enable row level security;
alter table public.transactions     enable row level security;
alter table public.monthly_settings enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "accounts: own rows" on public.accounts;
create policy "accounts: own rows" on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "categories: own rows" on public.categories;
create policy "categories: own rows" on public.categories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "transactions: own rows" on public.transactions;
create policy "transactions: own rows" on public.transactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "monthly_settings: own rows" on public.monthly_settings;
create policy "monthly_settings: own rows" on public.monthly_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Only signed-in users can touch these tables at all.
revoke all on public.profiles, public.accounts, public.categories, public.transactions, public.monthly_settings from anon;
grant select, insert, update, delete
  on public.profiles, public.accounts, public.categories, public.transactions, public.monthly_settings
  to authenticated;
