-- Migration: add a readable, unique PDF code for branded PDF URLs.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.
--
-- The public PDF viewer used to live at /pdf/<uuid>. It now resolves a readable
-- code instead, e.g. /pdf/JUICES4LIFE2343 (business name + a random 4-digit
-- number). The code is generated in the app when a PDF is uploaded; this column
-- stores it. Old /pdf/<uuid> links still work as a fallback.

alter table public.profiles add column if not exists pdf_code text;

-- Codes must be unique. Multiple NULLs are allowed (profiles without a PDF).
create unique index if not exists profiles_pdf_code_idx on public.profiles (pdf_code);

notify pgrst, 'reload schema';
