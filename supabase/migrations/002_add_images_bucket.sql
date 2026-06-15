-- Migration: add a public 'images' storage bucket for profile header/logo
-- images. Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New
-- query). Safe to re-run.
--
-- Why: images were previously embedded as base64 inside the profiles row,
-- which made saves and public-page loads slow (megabytes of text per row).
-- They now upload to this bucket and the row stores only a small public URL.

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

notify pgrst, 'reload schema';
