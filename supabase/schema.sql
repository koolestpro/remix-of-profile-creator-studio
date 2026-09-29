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
  secondary_image_zoom integer not null default 100,
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
  powered_by_logo      text not null default 'blue',
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
alter table public.profiles add column if not exists powered_by_logo      text not null default 'blue';
alter table public.profiles add column if not exists secondary_image_zoom integer not null default 100;

-- Each readable PDF code (e.g. JUICES4LIFE2343) must be unique. Multiple NULLs
-- are allowed, so profiles without a PDF are unaffected.
create unique index if not exists profiles_pdf_code_idx on public.profiles (pdf_code);

-- Links can each carry their own uploaded PDF (icon "pdf" — "Upload PDF" in
-- the editor), stored as extra keys (pdfUrl/pdfName/pdfCode) inside the JSONB
-- links array rather than a separate column. This index makes the public
-- /pdf/:code page's containment lookup (links @> '[{"pdfCode": "..."}]') fast.
create index if not exists profiles_links_gin_idx on public.profiles using gin (links jsonb_path_ops);

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

-- ------------------------------------------------------------
-- LINK CLICKS
-- Time-based click counter for the editor: a link_clicks event table plus
-- RPCs to record a click and query totals by day/link over any date range
-- (day/week/month/year presets or a custom range, with a "compare to"
-- period) — the click-side counterpart to the scan/view counter above.
-- ------------------------------------------------------------
create table if not exists public.link_clicks (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  link_id    text not null,
  clicked_at timestamptz not null default now()
);

create index if not exists link_clicks_profile_time_idx
  on public.link_clicks (profile_id, clicked_at);

alter table public.link_clicks enable row level security;
grant select on public.link_clicks to authenticated;

drop policy if exists "auth read link_clicks" on public.link_clicks;
create policy "auth read link_clicks" on public.link_clicks
  for select to authenticated using (true);

create or replace function public.record_link_click(p_slug text, p_link_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  select id into v_profile_id from public.profiles where slug = p_slug;
  if v_profile_id is null then
    return;
  end if;
  insert into public.link_clicks (profile_id, link_id) values (v_profile_id, p_link_id);
end;
$$;

grant execute on function public.record_link_click(text, text) to anon, authenticated;

create or replace function public.get_link_click_series(
  p_profile_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table(day date, clicks bigint)
language sql
stable
security definer
set search_path = public
as $$
  select date_trunc('day', clicked_at)::date as day, count(*)::bigint as clicks
  from public.link_clicks
  where profile_id = p_profile_id
    and clicked_at >= p_from
    and clicked_at < p_to
  group by 1
  order by 1;
$$;

grant execute on function public.get_link_click_series(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.get_link_click_counts(
  p_profile_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table(link_id text, clicks bigint)
language sql
stable
security definer
set search_path = public
as $$
  select link_id, count(*)::bigint as clicks
  from public.link_clicks
  where profile_id = p_profile_id
    and clicked_at >= p_from
    and clicked_at < p_to
  group by 1
  order by clicks desc;
$$;

grant execute on function public.get_link_click_counts(uuid, timestamptz, timestamptz) to authenticated;

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

-- ------------------------------------------------------------
-- STAFF ROLE (migration 011): create & edit, but no deleting
-- 1) Who is staff --------------------------------------------------------
create table if not exists public.staff_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.staff_users enable row level security;

-- A signed-in user may only see their own row (the app uses this to hide the
-- delete buttons). Nobody can write through the API — only the SQL Editor.
grant select on public.staff_users to authenticated;
drop policy if exists "read own staff row" on public.staff_users;
create policy "read own staff row" on public.staff_users
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff_users where user_id = auth.uid());
$$;

grant execute on function public.is_staff() to authenticated;

-- Helper for the owner, run from the SQL Editor:
--   select public.add_staff('va@example.com');
--   select public.remove_staff('va@example.com');   -- promote back to admin
create or replace function public.add_staff(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No user with email %. Create them under Authentication -> Users first.', p_email;
  end if;
  insert into public.staff_users (user_id) values (v_id) on conflict do nothing;
end;
$$;

create or replace function public.remove_staff(p_email text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.staff_users
   where user_id in (select id from auth.users where lower(email) = lower(trim(p_email)));
$$;

-- Not callable through the API, so staff can't promote themselves.
revoke execute on function public.add_staff(text)    from public, anon, authenticated;
revoke execute on function public.remove_staff(text) from public, anon, authenticated;

-- 2) Profiles: split the old "for all" policy so DELETE can be withheld ----
drop policy if exists "auth write profiles" on public.profiles;
drop policy if exists "auth insert profiles" on public.profiles;
drop policy if exists "auth update profiles" on public.profiles;
drop policy if exists "admin delete profiles" on public.profiles;

create policy "auth insert profiles" on public.profiles
  for insert to authenticated with check (true);
create policy "auth update profiles" on public.profiles
  for update to authenticated using (true) with check (true);
create policy "admin delete profiles" on public.profiles
  for delete to authenticated using (not public.is_staff());

-- 3) Folders --------------------------------------------------------------
drop policy if exists "auth all folders" on public.folders;
drop policy if exists "auth read folders" on public.folders;
drop policy if exists "auth insert folders" on public.folders;
drop policy if exists "auth update folders" on public.folders;
drop policy if exists "admin delete folders" on public.folders;

create policy "auth read folders" on public.folders
  for select to authenticated using (true);
create policy "auth insert folders" on public.folders
  for insert to authenticated with check (true);
create policy "auth update folders" on public.folders
  for update to authenticated using (true) with check (true);
create policy "admin delete folders" on public.folders
  for delete to authenticated using (not public.is_staff());

-- 4) Storage (uploaded images / PDFs) ------------------------------------
-- Upload and replace stay open to staff; deleting files does not.
-- Reads are already public via the "public read ..." policies.
drop policy if exists "auth write images" on storage.objects;
drop policy if exists "auth insert images" on storage.objects;
drop policy if exists "auth update images" on storage.objects;
drop policy if exists "admin delete images" on storage.objects;

create policy "auth insert images" on storage.objects
  for insert to authenticated with check (bucket_id = 'images');
create policy "auth update images" on storage.objects
  for update to authenticated
  using (bucket_id = 'images') with check (bucket_id = 'images');
create policy "admin delete images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and not public.is_staff());

drop policy if exists "auth write pdfs" on storage.objects;
drop policy if exists "auth insert pdfs" on storage.objects;
drop policy if exists "auth update pdfs" on storage.objects;
drop policy if exists "admin delete pdfs" on storage.objects;

create policy "auth insert pdfs" on storage.objects
  for insert to authenticated with check (bucket_id = 'pdfs');
create policy "auth update pdfs" on storage.objects
  for update to authenticated
  using (bucket_id = 'pdfs') with check (bucket_id = 'pdfs');
create policy "admin delete pdfs" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pdfs' and not public.is_staff());

notify pgrst, 'reload schema';

-- ============================================================
-- Done. Create your admin user under Authentication → Users → Add user
-- (set "Auto Confirm User"). There is no public sign-up.
-- ============================================================
