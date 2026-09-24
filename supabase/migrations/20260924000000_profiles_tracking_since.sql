-- Follow-up for projects set up from an earlier copy of the init migration:
-- make sure profiles.tracking_since exists (the day logging began; earlier
-- days don't count as "no-spend"). Safe to run more than once.
alter table public.profiles add column if not exists tracking_since date;
