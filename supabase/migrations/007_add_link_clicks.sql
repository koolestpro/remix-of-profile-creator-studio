-- ============================================================
-- 007 — Link click tracking
-- Adds a link_clicks event table plus RPCs so the editor can show a
-- time-filterable click counter for the profile's links (mirrors the
-- existing view/scan counter, but per-link and time-based: filter by
-- day/week/month/year or a custom range, with a "compare to" period).
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.link_clicks (
  id         bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  link_id    text not null,
  clicked_at timestamptz not null default now()
);

create index if not exists link_clicks_profile_time_idx
  on public.link_clicks (profile_id, clicked_at);

alter table public.link_clicks enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.link_clicks to authenticated;

-- Only admins can read raw events. Public visitors never query this table
-- directly — they only ever call record_link_click() below.
drop policy if exists "auth read link_clicks" on public.link_clicks;
create policy "auth read link_clicks" on public.link_clicks
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- Record a click from the public profile page. SECURITY DEFINER so an
-- anonymous visitor can insert an event row without any table grant, the
-- same pattern as increment_scan for view counts.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Daily totals for the trend chart in the editor.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Per-link totals for the breakdown list in the editor.
-- ------------------------------------------------------------
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

notify pgrst, 'reload schema';
