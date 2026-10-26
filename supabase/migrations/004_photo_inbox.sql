-- Temporary holding area for photos sent from a phone to the desktop app (see functions/photo-relay).
create table if not exists public.photo_inbox (
  id uuid primary key default gen_random_uuid(),
  session text not null,
  image text not null,
  created_at timestamptz not null default now()
);
create index if not exists photo_inbox_session_idx on public.photo_inbox (session, created_at);
-- Only the edge function (service role) touches this table.
alter table public.photo_inbox enable row level security;
