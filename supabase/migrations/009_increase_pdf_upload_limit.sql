-- Migration: raise the max file size for the "pdfs" storage bucket.
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Cause: the "pdfs" bucket was created without a file_size_limit, so it fell
-- back to Supabase's default cap (50MB on most projects). Uploads larger than
-- that (e.g. a 55MB PDF) are rejected client-side before they ever reach
-- Storage — the JS SDK returns a "Payload too large" / "exceeded max size" error.
--
-- IMPORTANT: this bucket-level limit cannot exceed your project's GLOBAL
-- upload size cap. Also check/raise that in the Supabase Dashboard under
-- Project Settings → Storage → "Upload file size limit" — if it's still 50MB
-- there, this migration alone won't fix it.

update storage.buckets
set file_size_limit = 104857600 -- 100 MB, in bytes (adjust as needed)
where id = 'pdfs';

notify pgrst, 'reload schema';
