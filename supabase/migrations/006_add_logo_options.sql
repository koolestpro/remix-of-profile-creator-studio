-- ============================================================
-- 006 — Logo customization options
-- Adds:
--   1. powered_by_logo — which "Powered by Tap and Rate" badge variant to
--      show ('blue' navy logo for light backgrounds, or 'white' logo for
--      dark backgrounds, where the blue version disappears).
--   2. secondary_image_zoom — user-adjustable zoom level (percent, 100-200)
--      for the secondary image/logo, so an over- or under-cropped upload
--      can be corrected without re-uploading.
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

alter table public.profiles
  add column if not exists powered_by_logo text not null default 'blue';

alter table public.profiles
  add column if not exists secondary_image_zoom integer not null default 100;

-- Tell PostgREST to reload its schema cache (fixes stale-cache 500s after
-- adding columns).
notify pgrst, 'reload schema';
