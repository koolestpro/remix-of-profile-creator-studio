-- ============================================================
-- 010 — Business card profile type
-- Adds a layout selector to every profile plus a single jsonb blob holding
-- the fields that only the business card layout uses (full name, job title,
-- about/contact copy, phone, email, location, website, social icons).
--
-- Using one jsonb column instead of a column per field means future card
-- fields need no further migrations, and a profile toggled from "card" back
-- to "landing" keeps its card content intact.
--
-- Existing rows default to 'landing', so every profile created before this
-- migration renders exactly as it did before.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

alter table public.profiles
  add column if not exists profile_type text not null default 'landing';

alter table public.profiles
  add column if not exists card_data jsonb;

-- Guard against typos writing an unrenderable layout value.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_profile_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_type_check
      check (profile_type in ('landing', 'card'));
  end if;
end $$;

-- Dashboards filter and count by layout, so keep that lookup cheap.
create index if not exists profiles_profile_type_idx
  on public.profiles (profile_type);
