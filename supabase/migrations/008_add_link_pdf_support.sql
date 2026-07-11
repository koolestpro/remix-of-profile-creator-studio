-- ============================================================
-- 008 — Per-link PDF uploads ("Upload PDF" link type)
-- Links already live as JSONB inside profiles.links (title/icon/url/etc.).
-- This migration adds no new columns — a link's pdfUrl/pdfName/pdfCode just
-- become extra keys in that JSON — but it adds a GIN index so the public
-- /pdf/:code page can resolve a link-level PDF code quickly via a JSONB
-- containment query (links @> '[{"pdfCode": "..."}]'), the same way
-- profiles.pdf_code already resolves the main-button PDF.
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create index if not exists profiles_links_gin_idx
  on public.profiles using gin (links jsonb_path_ops);

notify pgrst, 'reload schema';
