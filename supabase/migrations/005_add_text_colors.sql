-- ============================================================
-- 005 — Per-element text colors
-- Adds two color columns so the name/tagline/"powered by" text and the
-- action text (View Menu, Share, link arrows) can be coloured independently
-- of each other. Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- name / tagline / "powered by" text
alter table public.profiles
  add column if not exists text_color text not null default '#111111';

-- View Menu button, Share button and link arrow text
alter table public.profiles
  add column if not exists action_text_color text not null default '#FFFFFF';
