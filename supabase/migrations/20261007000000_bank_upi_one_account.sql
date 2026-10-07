-- ─────────────────────────────────────────────────────────────────────
-- Where'dItGo — Bank and UPI are one account
--
-- UPI money is bank money, so each ledger's UPI account is folded into
-- its bank account:
--   · its transactions and month-start adjustments move across
--   · the two opening balances are added together
--   · the bank account is renamed "Bank / UPI" (if it's still called "Bank")
--   · the UPI account is removed
-- Totals don't change; only which account the money is filed under.
--
-- The rows as they were are kept in private.bank_upi_merge_backup.
-- All or nothing: if a check at the end fails, nothing is changed.
-- Safe to run more than once: a second run finds nothing to merge.
-- ─────────────────────────────────────────────────────────────────────

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.bank_upi_merge_backup (
  id        bigint generated always as identity primary key,
  merged_at timestamptz not null default now(),
  what      text not null check (what in ('account', 'transaction', 'month')),
  row_data  jsonb not null
);
alter table private.bank_upi_merge_backup enable row level security;
revoke all on private.bank_upi_merge_backup from public, anon, authenticated;

do $$
declare
  upi         record;
  target      public.accounts%rowtype;
  tx_before   bigint;
  tx_after    bigint;
  open_before numeric;
  open_after  numeric;
  n           bigint;
  moved       bigint := 0;
  merged      integer := 0;
begin
  if not exists (select 1 from public.accounts where kind = 'upi') then
    return;
  end if;

  select count(*) into tx_before from public.transactions;
  select coalesce(sum(opening_balance), 0) into open_before from public.accounts;

  -- This is bookkeeping, not an edit by a person: leave updated_at alone and
  -- keep "changed account" out of every transaction's paper trail.
  alter table public.transactions disable trigger transactions_touch;
  alter table public.transactions disable trigger transactions_activity;

  for upi in
    select * from public.accounts where kind = 'upi' order by user_id, archived, sort_order, created_at
  loop
    select * into target
      from public.accounts
     where user_id = upi.user_id and kind = 'bank'
     order by archived, sort_order, created_at
     limit 1;

    insert into private.bank_upi_merge_backup (what, row_data) values ('account', to_jsonb(upi));

    if target.id is null then
      -- No bank account to fold into: this one becomes it.
      update public.accounts
         set kind = 'bank',
             name = case when name = 'UPI' then 'Bank / UPI' else name end
       where id = upi.id;
      merged := merged + 1;
      continue;
    end if;

    insert into private.bank_upi_merge_backup (what, row_data) values ('account', to_jsonb(target));
    insert into private.bank_upi_merge_backup (what, row_data)
      select 'transaction', jsonb_build_object('id', t.id, 'account_id', t.account_id)
        from public.transactions t where t.account_id = upi.id;
    insert into private.bank_upi_merge_backup (what, row_data)
      select 'month', to_jsonb(m) from public.monthly_settings m where m.adjustment_account_id = upi.id;

    update public.transactions set account_id = target.id where account_id = upi.id;
    get diagnostics n = row_count;
    moved := moved + n;

    update public.monthly_settings set adjustment_account_id = target.id where adjustment_account_id = upi.id;

    update public.accounts a
       set opening_balance = a.opening_balance + upi.opening_balance,
           -- an account that's still in use must stay visible
           archived = a.archived and upi.archived,
           name = case
                    when a.name = 'Bank' and not exists (
                      select 1 from public.accounts o where o.user_id = a.user_id and o.name = 'Bank / UPI'
                    ) then 'Bank / UPI'
                    else a.name
                  end
     where a.id = target.id;

    delete from public.accounts where id = upi.id;
    merged := merged + 1;
  end loop;

  alter table public.transactions enable trigger transactions_touch;
  alter table public.transactions enable trigger transactions_activity;

  -- Nothing may be lost or invented.
  select count(*) into tx_after from public.transactions;
  select coalesce(sum(opening_balance), 0) into open_after from public.accounts;
  if tx_after <> tx_before or open_after <> open_before or exists (select 1 from public.accounts where kind = 'upi') then
    raise exception 'Bank/UPI merge check failed (transactions % -> %, opening total % -> %). Nothing was changed.',
      tx_before, tx_after, open_before, open_after;
  end if;

  raise notice 'Bank/UPI merge: % UPI account(s) folded in, % transaction(s) moved.', merged, moved;
end;
$$;
