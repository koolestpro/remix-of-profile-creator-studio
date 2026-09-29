-- ============================================================
-- 011 — Staff (worker) role: can create & edit, cannot delete
-- Lets the owner give a VA / worker a login that can create and edit
-- profiles, folders, images and PDFs but can NOT delete any of them.
--
-- Everyone who already has a login stays a full admin. A user becomes staff
-- only when listed in public.staff_users (see "Add a staff member" below).
-- The restriction is enforced by Postgres row-level security, so it holds
-- even if the staff member calls the API directly rather than using the UI.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

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
