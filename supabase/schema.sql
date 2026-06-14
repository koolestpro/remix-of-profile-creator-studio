-- ============================================================
-- Tapandrate — Link Profile Studio : Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- FOLDERS
-- ------------------------------------------------------------
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PROFILES  (links are stored inline as JSONB to match the app's data model)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique,
  profile_name         text not null default 'Untitled Profile',
  folder_id            uuid references public.folders(id) on delete set null,
  header_image         text,
  secondary_image      text,
  business_name        text not null default '',
  business_description text not null default '',
  bg_color             text not null default '#f4ead5',
  button_color         text not null default '#111111',
  main_button_text     text not null default '',
  main_button_url      text not null default '',
  main_button_pdf      text,
  main_button_pdf_name text,
  links                jsonb not null default '[]'::jsonb,
  show_powered_by      boolean,
  show_menu_button     boolean,
  paused               boolean not null default false,
  scan_count           integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists profiles_slug_idx   on public.profiles (slug);
create index if not exists profiles_folder_idx on public.profiles (folder_id);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.folders  enable row level security;

-- Public pages (/p/:slug) must be readable by anyone — this is public data.
drop policy if exists "public read profiles" on public.profiles;
create policy "public read profiles"
  on public.profiles for select
  using (true);

-- Only signed-in admins can create / edit / delete profiles.
drop policy if exists "auth write profiles" on public.profiles;
create policy "auth write profiles"
  on public.profiles for all
  to authenticated
  using (true) with check (true);

-- Folders are admin-only (no public read needed).
drop policy if exists "auth all folders" on public.folders;
create policy "auth all folders"
  on public.folders for all
  to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- SCAN COUNTER
-- Lets a public visitor bump scan_count without granting write access.
-- SECURITY DEFINER runs with the function owner's rights, but only does
-- exactly this one safe update.
-- ------------------------------------------------------------
create or replace function public.increment_scan(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set scan_count = scan_count + 1
   where slug = p_slug;
$$;

grant execute on function public.increment_scan(text) to anon, authenticated;

-- ============================================================
-- Done. Create your admin user under Authentication → Users → Add user
-- (set "Auto Confirm User"). There is no public sign-up.
-- ============================================================
