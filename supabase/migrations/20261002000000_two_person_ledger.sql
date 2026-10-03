-- ─────────────────────────────────────────────────────────────────────
-- Where'dItGo — the two-person ledger
--
--   Jais    owns the ledger: full control of his money data.
--   Khushi  observes it: reads everything, edits existing transactions,
--           leaves permanent comments. She can't create or delete
--           transactions, accounts or categories.
--
-- Everything here is enforced by Postgres (RLS + triggers); the app's
-- role checks are only there to hide buttons.
--
-- Safe to run more than once. Run after 20260923000000_init.sql.
-- After running it, link the two people with private.setup_ledger(...)
-- and set PINs with private.set_pin(...) — see DEPLOYMENT.md.
-- ─────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;

-- Older projects: make sure columns added since the first release exist.
alter table public.profiles add column if not exists tracking_since date;
alter table public.profiles add column if not exists person text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_person_check') then
    alter table public.profiles add constraint profiles_person_check check (person in ('jais', 'khushi'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_person_key') then
    alter table public.profiles add constraint profiles_person_key unique (person);
  end if;
end;
$$;

-- ── 1. Who can see whose ledger ─────────────────────────────────────

create table if not exists public.ledger_members (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  member_id  uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'observer' check (role in ('observer')),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  unique (member_id), -- a person observes at most one ledger
  check (owner_id <> member_id)
);

-- Helpers used by every policy. SECURITY DEFINER so they can read
-- ledger_members without tripping over its own RLS.
create or replace function public.is_observer()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.ledger_members m where m.member_id = (select auth.uid()));
$$;

-- Owner of this ledger, or someone observing it.
create or replace function public.can_view_ledger(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid())
      or exists (
        select 1 from public.ledger_members m
        where m.owner_id = p_owner and m.member_id = (select auth.uid())
      );
$$;

-- Only the owner, and only if they aren't an observer of someone else.
create or replace function public.is_ledger_owner(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid()) and not public.is_observer();
$$;

-- The current user observes this ledger (Khushi looking at Jais's).
create or replace function public.observes(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_members m
    where m.owner_id = p_owner and m.member_id = (select auth.uid())
  );
$$;

-- The two people in a ledger can see each other's names.
create or replace function public.shares_ledger_with(p_other uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_members m
    where (m.owner_id = (select auth.uid()) and m.member_id = p_other)
       or (m.member_id = (select auth.uid()) and m.owner_id = p_other)
  );
$$;

revoke all on function public.is_observer(), public.can_view_ledger(uuid), public.is_ledger_owner(uuid),
  public.observes(uuid), public.shares_ledger_with(uuid) from public, anon;
grant execute on function public.is_observer(), public.can_view_ledger(uuid), public.is_ledger_owner(uuid),
  public.observes(uuid), public.shares_ledger_with(uuid) to authenticated;

-- ── 2. Who did what to a transaction ─────────────────────────────────

alter table public.transactions add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.transactions add column if not exists updated_by uuid references auth.users (id) on delete set null;
update public.transactions set created_by = user_id where created_by is null;
update public.transactions set updated_by = created_by where updated_by is null;

-- created_by/updated_by come from the session, never from the client.
-- A transaction can't be moved into another ledger.
create or replace function public.stamp_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by, new.user_id);
    new.updated_by := new.created_by;
  else
    if new.user_id is distinct from old.user_id then
      raise exception 'transactions cannot move between ledgers' using errcode = '42501';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := coalesce((select auth.uid()), new.updated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_stamp on public.transactions;
create trigger transactions_stamp
  before insert or update on public.transactions
  for each row execute function public.stamp_transaction();

-- ── 3. Khushi's permanent notes on transactions ──────────────────────

create table if not exists public.transaction_comments (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  author_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  comment        text not null check (char_length(btrim(comment)) between 1 and 500),
  created_at     timestamptz not null default now()
);

create index if not exists transaction_comments_tx_idx on public.transaction_comments (transaction_id, created_at);

create or replace function public.stamp_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.author_id := coalesce((select auth.uid()), new.author_id);
  new.comment := btrim(new.comment);
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists transaction_comments_stamp on public.transaction_comments;
create trigger transaction_comments_stamp
  before insert on public.transaction_comments
  for each row execute function public.stamp_comment();

-- ── 4. Activity log (written only by triggers) ───────────────────────

create table if not exists public.activity_log (
  id              uuid primary key default gen_random_uuid(),
  ledger_owner_id uuid not null references auth.users (id) on delete cascade,
  actor_id        uuid references auth.users (id) on delete set null,
  action          text not null check (action in (
                    'transaction_created', 'transaction_updated', 'transaction_deleted',
                    'comment_added', 'account_created', 'category_created')),
  entity_type     text not null check (entity_type in ('transaction', 'comment', 'account', 'category')),
  entity_id       uuid not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists activity_log_ledger_idx on public.activity_log (ledger_owner_id, created_at desc);
create index if not exists activity_log_entity_idx on public.activity_log (entity_id);

create or replace function public.log_transaction_activity()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  changes jsonb := '{}'::jsonb;
  field text;
  before_row jsonb;
  after_row jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (ledger_owner_id, actor_id, action, entity_type, entity_id, metadata)
    values (new.user_id, coalesce((select auth.uid()), new.created_by), 'transaction_created', 'transaction', new.id,
            jsonb_build_object('type', new.type, 'amount', new.amount, 'description', new.description));
    return new;
  elsif tg_op = 'UPDATE' then
    before_row := to_jsonb(old);
    after_row := to_jsonb(new);
    foreach field in array array['type', 'amount', 'category_id', 'account_id', 'description', 'date', 'time', 'note'] loop
      if before_row -> field is distinct from after_row -> field then
        changes := changes || jsonb_build_object(field, jsonb_build_array(before_row -> field, after_row -> field));
      end if;
    end loop;
    if changes <> '{}'::jsonb then
      insert into public.activity_log (ledger_owner_id, actor_id, action, entity_type, entity_id, metadata)
      values (new.user_id, coalesce((select auth.uid()), new.updated_by), 'transaction_updated', 'transaction', new.id,
              jsonb_build_object('changes', changes));
    end if;
    return new;
  else
    insert into public.activity_log (ledger_owner_id, actor_id, action, entity_type, entity_id, metadata)
    values (old.user_id, (select auth.uid()), 'transaction_deleted', 'transaction', old.id,
            jsonb_build_object('type', old.type, 'amount', old.amount, 'description', old.description, 'date', old.date));
    return old;
  end if;
end;
$$;

drop trigger if exists transactions_activity on public.transactions;
create trigger transactions_activity
  after insert or update or delete on public.transactions
  for each row execute function public.log_transaction_activity();

create or replace function public.log_comment_activity()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (ledger_owner_id, actor_id, action, entity_type, entity_id, metadata)
  select t.user_id, new.author_id, 'comment_added', 'comment', new.id,
         jsonb_build_object('transaction_id', new.transaction_id, 'preview', left(new.comment, 80))
  from public.transactions t where t.id = new.transaction_id;
  return new;
end;
$$;

drop trigger if exists transaction_comments_activity on public.transaction_comments;
create trigger transaction_comments_activity
  after insert on public.transaction_comments
  for each row execute function public.log_comment_activity();

create or replace function public.log_created_activity()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.activity_log (ledger_owner_id, actor_id, action, entity_type, entity_id, metadata)
  values (new.user_id, (select auth.uid()),
          case tg_table_name when 'accounts' then 'account_created' else 'category_created' end,
          case tg_table_name when 'accounts' then 'account' else 'category' end,
          new.id, jsonb_build_object('name', new.name));
  return new;
end;
$$;

drop trigger if exists accounts_activity on public.accounts;
create trigger accounts_activity after insert on public.accounts
  for each row execute function public.log_created_activity();
drop trigger if exists categories_activity on public.categories;
create trigger categories_activity after insert on public.categories
  for each row execute function public.log_created_activity();

-- Trigger functions aren't for calling directly.
revoke all on function public.stamp_transaction(), public.stamp_comment(), public.log_transaction_activity(),
  public.log_comment_activity(), public.log_created_activity() from public, anon, authenticated;

-- ── 5. Row Level Security ───────────────────────────────────────────

alter table public.ledger_members       enable row level security;
alter table public.transaction_comments enable row level security;
alter table public.activity_log         enable row level security;

-- profiles: yourself + the other person in your ledger
drop policy if exists "profiles: own row" on public.profiles;
drop policy if exists "profiles: read self and partner" on public.profiles;
drop policy if exists "profiles: insert self" on public.profiles;
drop policy if exists "profiles: update self" on public.profiles;
create policy "profiles: read self and partner" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.shares_ledger_with(id));
create policy "profiles: insert self" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- accounts, categories, monthly_settings: both read, only the owner writes
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'monthly_settings'] loop
    execute format('drop policy if exists "%s: own rows" on public.%I', t, t);
    execute format('drop policy if exists "%s: ledger read" on public.%I', t, t);
    execute format('drop policy if exists "%s: owner insert" on public.%I', t, t);
    execute format('drop policy if exists "%s: owner update" on public.%I', t, t);
    execute format('drop policy if exists "%s: owner delete" on public.%I', t, t);
    execute format('create policy "%s: ledger read" on public.%I for select to authenticated using (public.can_view_ledger(user_id))', t, t);
    execute format('create policy "%s: owner insert" on public.%I for insert to authenticated with check (public.is_ledger_owner(user_id))', t, t);
    execute format('create policy "%s: owner update" on public.%I for update to authenticated using (public.is_ledger_owner(user_id)) with check (public.is_ledger_owner(user_id))', t, t);
    execute format('create policy "%s: owner delete" on public.%I for delete to authenticated using (public.is_ledger_owner(user_id))', t, t);
  end loop;
end;
$$;

-- transactions: both read and edit; only the owner creates and deletes
drop policy if exists "transactions: own rows" on public.transactions;
drop policy if exists "transactions: ledger read" on public.transactions;
drop policy if exists "transactions: owner insert" on public.transactions;
drop policy if exists "transactions: ledger update" on public.transactions;
drop policy if exists "transactions: owner delete" on public.transactions;
create policy "transactions: ledger read" on public.transactions
  for select to authenticated using (public.can_view_ledger(user_id));
create policy "transactions: owner insert" on public.transactions
  for insert to authenticated with check (public.is_ledger_owner(user_id));
create policy "transactions: ledger update" on public.transactions
  for update to authenticated using (public.can_view_ledger(user_id)) with check (public.can_view_ledger(user_id));
create policy "transactions: owner delete" on public.transactions
  for delete to authenticated using (public.is_ledger_owner(user_id));

-- comments: both read; only the observer writes; nobody edits or deletes
drop policy if exists "comments: ledger read" on public.transaction_comments;
drop policy if exists "comments: observer insert" on public.transaction_comments;
create policy "comments: ledger read" on public.transaction_comments
  for select to authenticated using (
    exists (select 1 from public.transactions t where t.id = transaction_id and public.can_view_ledger(t.user_id))
  );
create policy "comments: observer insert" on public.transaction_comments
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.transactions t where t.id = transaction_id and public.observes(t.user_id))
  );

-- activity: both read; written by triggers only
drop policy if exists "activity: ledger read" on public.activity_log;
create policy "activity: ledger read" on public.activity_log
  for select to authenticated using (public.can_view_ledger(ledger_owner_id));

-- ledger membership: readable by the two people in it; set up by admin only
drop policy if exists "ledger_members: read own" on public.ledger_members;
create policy "ledger_members: read own" on public.ledger_members
  for select to authenticated using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));

-- Table privileges (RLS still applies on top). Nothing for anon.
revoke all on public.ledger_members, public.transaction_comments, public.activity_log from anon;
revoke all on public.ledger_members, public.transaction_comments, public.activity_log from authenticated;
grant select on public.ledger_members, public.activity_log to authenticated;
grant select, insert on public.transaction_comments to authenticated;

-- profiles: you can't relabel yourself as the other person
revoke update on public.profiles from authenticated;
grant update (display_name, mascot_name, start_month, tracking_since, onboarded, prefs) on public.profiles to authenticated;

-- ── 6. PIN login ────────────────────────────────────────────────────
-- PINs live in a schema the API never exposes, bcrypt-hashed. Only the
-- pin-login Edge Function (service role) can check them, and repeated
-- wrong guesses lock the person out for longer and longer.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.pin_credentials (
  person          text primary key check (person in ('jais', 'khushi')),
  user_id         uuid not null unique references auth.users (id) on delete cascade,
  pin_hash        text,
  failed_attempts integer not null default 0,
  last_failed_at  timestamptz,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);
alter table private.pin_credentials enable row level security;

-- Lockout: 5 free tries, then 5 min, doubling each further miss, max 24 h.
-- A quiet day (no misses for 24 h) resets the count.
create or replace function private.register_pin_failure(p_person text)
returns table (retry_after integer, attempts_left integer)
language plpgsql security definer
set search_path = ''
as $$
declare
  attempts integer;
  lock_for interval;
begin
  update private.pin_credentials c
     set failed_attempts = case when c.last_failed_at < now() - interval '24 hours' then 1 else c.failed_attempts + 1 end,
         last_failed_at = now()
   where c.person = p_person
  returning c.failed_attempts into attempts;

  if attempts >= 5 then
    lock_for := least(interval '24 hours', interval '5 minutes' * power(2, attempts - 5));
    update private.pin_credentials c set locked_until = now() + lock_for where c.person = p_person;
  end if;

  return query select coalesce(ceil(extract(epoch from lock_for))::integer, 0), greatest(0, 5 - attempts);
end;
$$;

-- Called only by the pin-login Edge Function (service role).
create or replace function public.pin_login_check(p_person text, p_pin text)
returns table (ok boolean, uid uuid, retry_after integer, attempts_left integer)
language plpgsql security definer
set search_path = ''
as $$
declare
  c private.pin_credentials%rowtype;
begin
  select * into c from private.pin_credentials where person = p_person for update;
  if not found or c.pin_hash is null then
    return query select false, null::uuid, 0, -1; -- -1 = no PIN set up
    return;
  end if;

  if c.locked_until is not null and c.locked_until > now() then
    return query select false, null::uuid, ceil(extract(epoch from c.locked_until - now()))::integer, 0;
    return;
  end if;

  if p_pin ~ '^[0-9]{4}$' and c.pin_hash = extensions.crypt(p_pin, c.pin_hash) then
    update private.pin_credentials set failed_attempts = 0, locked_until = null where person = p_person;
    return query select true, c.user_id, 0, 5;
    return;
  end if;

  return query select false, null::uuid, f.retry_after, f.attempts_left from private.register_pin_failure(p_person) f;
end;
$$;

revoke all on function public.pin_login_check(text, text) from public, anon, authenticated;
revoke all on function private.register_pin_failure(text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema private to service_role;
    grant execute on function public.pin_login_check(text, text) to service_role;
  end if;
end;
$$;

-- Signed-in users can change their own PIN if they know the current one.
create or replace function public.change_my_pin(p_current text, p_new text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  c private.pin_credentials%rowtype;
begin
  select * into c from private.pin_credentials where user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'PIN login isn’t set up for this account yet.' using errcode = 'P0002';
  end if;
  if c.locked_until is not null and c.locked_until > now() then
    raise exception 'Too many wrong PINs. Try again in % min.', ceil(extract(epoch from c.locked_until - now()) / 60)
      using errcode = 'P0001';
  end if;
  if c.pin_hash is not null and (p_current !~ '^[0-9]{4}$' or c.pin_hash <> extensions.crypt(p_current, c.pin_hash)) then
    perform private.register_pin_failure(c.person);
    return false;
  end if;
  if p_new !~ '^[0-9]{4}$' then
    raise exception 'The new PIN has to be exactly 4 digits.' using errcode = '22023';
  end if;
  update private.pin_credentials
     set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)),
         failed_attempts = 0, locked_until = null, updated_at = now()
   where person = c.person;
  return true;
end;
$$;

revoke all on function public.change_my_pin(text, text) from public, anon;
grant execute on function public.change_my_pin(text, text) to authenticated;

-- ── 7. Admin helpers (run these in the SQL editor) ───────────────────

-- Link the two auth users: Jais owns the ledger, Khushi observes it.
create or replace function private.setup_ledger(p_jais_email text, p_khushi_email text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  jais uuid;
  khushi uuid;
begin
  select id into jais from auth.users where lower(email) = lower(btrim(p_jais_email));
  if jais is null then raise exception 'No auth user with email % (create Jais in Authentication → Users first)', p_jais_email; end if;
  select id into khushi from auth.users where lower(email) = lower(btrim(p_khushi_email));
  if khushi is null then raise exception 'No auth user with email % (create Khushi in Authentication → Users first)', p_khushi_email; end if;
  if jais = khushi then raise exception 'Jais and Khushi need two different accounts'; end if;

  insert into public.profiles (id) values (jais), (khushi) on conflict (id) do nothing;
  update public.profiles set person = null where person in ('jais', 'khushi') and id not in (jais, khushi);
  update public.profiles set person = 'jais' where id = jais;
  update public.profiles set person = 'khushi' where id = khushi;
  update public.profiles set display_name = 'Khushi' where id = khushi and display_name = '';

  delete from public.ledger_members where member_id in (jais, khushi) or owner_id = khushi;
  insert into public.ledger_members (owner_id, member_id, role) values (jais, khushi, 'observer');

  insert into private.pin_credentials (person, user_id) values ('jais', jais), ('khushi', khushi)
  on conflict (person) do update set user_id = excluded.user_id, updated_at = now();

  return 'Linked: Jais owns the ledger, Khushi observes it. Now set both PINs with private.set_pin(...).';
end;
$$;

-- Set (or reset) someone's PIN. Plain digits go in; only a bcrypt hash is stored.
create or replace function private.set_pin(p_person text, p_pin text)
returns text
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_pin !~ '^[0-9]{4}$' then raise exception 'A PIN is exactly 4 digits'; end if;
  update private.pin_credentials
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
         failed_attempts = 0, locked_until = null, updated_at = now()
   where person = p_person;
  if not found then raise exception 'Unknown person % — run private.setup_ledger(...) first', p_person; end if;
  return format('PIN set for %s.', p_person);
end;
$$;

-- Clear a lockout without changing the PIN.
create or replace function private.unlock_pin(p_person text)
returns text
language sql security definer
set search_path = ''
as $$
  update private.pin_credentials set failed_attempts = 0, locked_until = null where person = p_person;
  select format('Unlocked %s.', p_person);
$$;

revoke all on function private.setup_ledger(text, text), private.set_pin(text, text), private.unlock_pin(text)
  from public, anon, authenticated;

-- ── 8. Realtime: let Khushi's notes and Jais's spending appear live ──

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.transactions;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.transaction_comments;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
