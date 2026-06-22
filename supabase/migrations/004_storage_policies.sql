-- Migration: fix "new row violates row-level security policy" on PDF/image upload.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.
--
-- Cause: Supabase Storage has its own row-level security on storage.objects.
-- A bucket created through the dashboard UI (or before these policies were
-- applied) has NO write policy, so even a logged-in admin's upload is rejected.
-- This script (re)creates both public buckets and the read/write policies.

-- 1) Buckets exist and are public (so the public profile pages can read files).
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

-- 2) Anyone can READ files by their public URL.
drop policy if exists "public read pdfs" on storage.objects;
create policy "public read pdfs" on storage.objects
  for select using (bucket_id = 'pdfs');

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects
  for select using (bucket_id = 'images');

-- 3) Logged-in admins can UPLOAD / replace / delete files.
drop policy if exists "auth write pdfs" on storage.objects;
create policy "auth write pdfs" on storage.objects
  for all to authenticated
  using (bucket_id = 'pdfs') with check (bucket_id = 'pdfs');

drop policy if exists "auth write images" on storage.objects;
create policy "auth write images" on storage.objects
  for all to authenticated
  using (bucket_id = 'images') with check (bucket_id = 'images');
