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
  text_color           text not null default '#111111',
  action_text_color    text not null default '#FFFFFF',
  main_button_text     text not null default '',
  main_button_url      text not null default '',
  main_button_pdf      text,
  main_button_pdf_name text,
  pdf_code             text unique,
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

-- Migrate older databases: add newer columns if they're missing.
alter table public.profiles add column if not exists main_button_pdf      text;
alter table public.profiles add column if not exists main_button_pdf_name text;
alter table public.profiles add column if not exists pdf_code             text;
alter table public.profiles add column if not exists show_powered_by      boolean;
alter table public.profiles add column if not exists show_menu_button     boolean;
alter table public.profiles add column if not exists text_color           text not null default '#111111';
alter table public.profiles add column if not exists action_text_color    text not null default '#FFFFFF';

-- Each readable PDF code (e.g. JUICES4LIFE2343) must be unique. Multiple NULLs
-- are allowed, so profiles without a PDF are unaffected.
create unique index if not exists profiles_pdf_code_idx on public.profiles (pdf_code);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.folders  enable row level security;

-- Table privileges. RLS decides which ROWS are visible/writable; GRANT decides
-- whether the role can touch the table at all. Missing grants can surface as a
-- 500 from the REST API, so set them explicitly.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update, delete on public.profiles to authenticated;
grant all on public.folders to authenticated;

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

-- Tell PostgREST to reload its schema cache (fixes stale-cache 500s after
-- adding columns or changing grants).
notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- STORAGE: 'pdfs' bucket for the main-button PDF upload
-- Storage has its own RLS on storage.objects (separate from the app tables),
-- which is why an upload fails until this bucket + policies exist.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do update set public = true;

-- Anyone can read a PDF by its public URL.
drop policy if exists "public read pdfs" on storage.objects;
create policy "public read pdfs" on storage.objects
  for select using (bucket_id = 'pdfs');

-- Logged-in admins can upload / replace / delete PDFs.
drop policy if exists "auth write pdfs" on storage.objects;
create policy "auth write pdfs" on storage.objects
  for all to authenticated
  using (bucket_id = 'pdfs') with check (bucket_id = 'pdfs');

-- ------------------------------------------------------------
-- STORAGE: 'images' bucket for header/secondary profile images
-- Images used to be embedded as base64 directly in the profiles row, which
-- bloated every save and every public-page read. They now upload here and the
-- row only stores a small public URL.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

-- Anyone can read an image by its public URL.
drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects
  for select using (bucket_id = 'images');

-- Logged-in admins can upload / replace / delete images.
drop policy if exists "auth write images" on storage.objects;
create policy "auth write images" on storage.objects
  for all to authenticated
  using (bucket_id = 'images') with check (bucket_id = 'images');

-- ============================================================
-- Done. Create your admin user under Authentication → Users → Add user
-- (set "Auto Confirm User"). There is no public sign-up.
-- ============================================================
