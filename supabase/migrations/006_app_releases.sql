-- Newest published version per platform. The desktop app reads this for "Update available".
-- Written only by the release workflow (service role); anyone may read it.
create table if not exists public.app_releases (
  platform  text primary key check (platform in ('win','mac')),
  version   text not null,
  url       text not null,
  notes     text not null default '',
  published timestamptz not null default now()
);
alter table public.app_releases enable row level security;
drop policy if exists "anyone can read releases" on public.app_releases;
create policy "anyone can read releases" on public.app_releases for select to anon, authenticated using (true);
