-- ============================================================================
-- CareTrack — Supabase schema
-- Run this once, in full, in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run).
-- Safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles — one row per login, mirrors auth.users with our own role field.
--    Created by the manage-user Edge Function (service role), never directly
--    by the browser. auth.users itself is Supabase's own table; we never
--    touch it directly from client code except via supabase-js auth calls.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  role text not null check (role in ('staff', 'admin', 'superadmin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Every signed-in user can see every profile EXCEPT the super admin's —
-- that row is only visible to the super admin themselves. This is the
-- actual enforcement of "hidden from other admins": it happens here, at
-- the database, not just by the app choosing not to render it.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select
  using (
    role <> 'superadmin'
    or id = auth.uid()
  );

-- No insert/update/delete policies on purpose: all user management goes
-- through the manage-user Edge Function (service role key), which bypasses
-- RLS entirely. A regular authenticated client can never write this table.

-- ----------------------------------------------------------------------------
-- 2. app_data — one JSON row per feature module (equipment register,
--    donations). This mirrors the shape the app already used in
--    localStorage 1:1, which is what keeps this migration to "swap the
--    storage backend" instead of "re-architect every page".
--
--    Known trade-off, documented in DEPLOYMENT_PLAN.md: RLS here is
--    row-level (per namespace), not field-level. Staff can write to the
--    equipment-register row because issuing/returning equipment legitimately
--    needs to update unit status nested inside it — the app's own UI just
--    never gives staff a way to add/delete equipment types. A technically
--    determined staff member hitting the REST API directly could bypass
--    that UI restriction. Low risk for a small trusted team; the fix if it
--    ever matters is normalizing equipment types/units into their own
--    tables with real per-column RLS (see the "Phase 2" section of
--    DEPLOYMENT_PLAN.md).
-- ----------------------------------------------------------------------------
create table if not exists public.app_data (
  namespace text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.app_data enable row level security;

-- Equipment register: every signed-in user (staff, admin, super admin) can
-- read and write. This is deliberate — Issue/Active Loans/History are the
-- pages staff are meant to use every day.
drop policy if exists "app_data_equipment_select" on public.app_data;
create policy "app_data_equipment_select" on public.app_data
  for select
  using (namespace = 'equipment-register' and auth.role() = 'authenticated');

drop policy if exists "app_data_equipment_upsert" on public.app_data;
create policy "app_data_equipment_upsert" on public.app_data
  for insert
  with check (namespace = 'equipment-register' and auth.role() = 'authenticated');

drop policy if exists "app_data_equipment_update" on public.app_data;
create policy "app_data_equipment_update" on public.app_data
  for update
  using (namespace = 'equipment-register' and auth.role() = 'authenticated')
  with check (namespace = 'equipment-register');

-- Donations (finance): admin and super admin only, both read and write —
-- matches the app's existing AdminOnly gating on every Finance/Donation page.
drop policy if exists "app_data_finance_select" on public.app_data;
create policy "app_data_finance_select" on public.app_data
  for select
  using (
    namespace = 'finance'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

drop policy if exists "app_data_finance_upsert" on public.app_data;
create policy "app_data_finance_upsert" on public.app_data
  for insert
  with check (
    namespace = 'finance'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

drop policy if exists "app_data_finance_update" on public.app_data;
create policy "app_data_finance_update" on public.app_data
  for update
  using (
    namespace = 'finance'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  )
  with check (namespace = 'finance');

-- Ambaji Account & SEOC Account (credit/debit ledgers): admin and super admin
-- only, same gating as Donation/finance — these are separate accountancy
-- books, each its own namespace so they never mix with each other or with
-- Donation. If a third named account ledger is ever added, copy this
-- six-policy block and swap the namespace string.
drop policy if exists "app_data_ambaji_select" on public.app_data;
create policy "app_data_ambaji_select" on public.app_data
  for select
  using (
    namespace = 'ambaji-account'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

drop policy if exists "app_data_ambaji_upsert" on public.app_data;
create policy "app_data_ambaji_upsert" on public.app_data
  for insert
  with check (
    namespace = 'ambaji-account'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

drop policy if exists "app_data_ambaji_update" on public.app_data;
create policy "app_data_ambaji_update" on public.app_data
  for update
  using (
    namespace = 'ambaji-account'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  )
  with check (namespace = 'ambaji-account');

drop policy if exists "app_data_seoc_select" on public.app_data;
create policy "app_data_seoc_select" on public.app_data
  for select
  using (
    namespace = 'seoc-account'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

drop policy if exists "app_data_seoc_upsert" on public.app_data;
create policy "app_data_seoc_upsert" on public.app_data
  for insert
  with check (
    namespace = 'seoc-account'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  );

drop policy if exists "app_data_seoc_update" on public.app_data;
create policy "app_data_seoc_update" on public.app_data
  for update
  using (
    namespace = 'seoc-account'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'superadmin'))
  )
  with check (namespace = 'seoc-account');

-- Keep updated_at honest on every write, regardless of what the client sends.
create or replace function public.touch_app_data_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists app_data_touch_updated_at on public.app_data;
create trigger app_data_touch_updated_at
  before update on public.app_data
  for each row execute function public.touch_app_data_updated_at();

-- Seed the two rows the app expects to always exist, so the first load
-- after a fresh install never has to special-case "row doesn't exist yet".
insert into public.app_data (namespace, data)
values
  ('equipment-register', '{"types": [], "allocations": []}'::jsonb),
  ('finance', '{"entries": []}'::jsonb),
  ('ambaji-account', '{"entries": []}'::jsonb),
  ('seoc-account', '{"entries": []}'::jsonb)
on conflict (namespace) do nothing;

-- ----------------------------------------------------------------------------
-- 3. activity_log — a real table, not a JSON blob. Every entry is its own
--    row, so "append a log entry" never needs a read-modify-write of the
--    whole log (which would otherwise require every writer to also have
--    read access, defeating "only the super admin can read this").
-- ----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  username text not null,
  role text not null,
  action text not null,
  details text not null
);

alter table public.activity_log enable row level security;

-- Anyone signed in can add an entry (that's how their own actions get
-- logged) — but only the super admin can ever read or clear the log.
drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));

drop policy if exists "activity_log_delete" on public.activity_log;
create policy "activity_log_delete" on public.activity_log
  for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));

create index if not exists activity_log_created_at_idx on public.activity_log (created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Realtime — lets every open tab/device see equipment and donation
--    changes made elsewhere within about a second, without a manual
--    refresh. Optional but recommended for a multi-device team.
--    Guarded with a existence check because, unlike every other statement
--    in this file, "alter publication ... add table" has no built-in
--    IF NOT EXISTS — re-running it unguarded on a project where it already
--    ran throws: ERROR 42710 "relation app_data is already member of
--    publication supabase_realtime". This is what made re-running the
--    whole file unsafe before; it's fixed now.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'app_data'
  ) then
    alter publication supabase_realtime add table public.app_data;
  end if;
end $$;

-- ============================================================================
-- After running this file, go create the two starter logins (the app no
-- longer seeds them itself — see DEPLOYMENT_PLAN.md "First-time setup"):
--   1. An admin account for whoever runs day-to-day operations.
--   2. The fixed super admin: username amish_251.
-- Both are created the same way — via Supabase Dashboard → Authentication →
-- Add user, then inserting a matching row into public.profiles. Exact
-- commands are in DEPLOYMENT_PLAN.md so the password never has to be
-- pasted into a SQL file that might end up in git history.
-- ============================================================================
