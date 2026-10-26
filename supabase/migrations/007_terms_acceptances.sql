-- Record of who accepted which version of the Terms and Privacy Policy, when, and from which IP address.
-- Written only by the accept-terms edge function (service role). No policies = no access for app users.
create table if not exists public.terms_acceptances (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,            -- deliberately no foreign key: the record outlives the account
  email         text,
  terms_version text not null,
  source        text not null check (source in ('signup','gate','signin_backfill')),
  ip_address    text,
  user_agent    text,
  accepted_at   timestamptz not null default now(),
  unique (user_id, terms_version)
);
alter table public.terms_acceptances enable row level security;
