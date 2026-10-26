-- Subscriptions (written only by the Paddle webhook using the service role)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  paddle_subscription_id text unique,
  paddle_customer_id text,
  status text not null default 'inactive',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Daily usage counter, used for rate limiting AI generations
create table if not exists public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.usage enable row level security;

create policy "users read own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- Atomically increments today's count. Returns false when the daily limit is reached.
create or replace function public.increment_usage(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day)
  do update set count = public.usage.count + 1
  returning count into new_count;

  if new_count > p_limit then
    update public.usage
      set count = count - 1
      where user_id = p_user and day = (now() at time zone 'utc')::date;
    return false;
  end if;
  return true;
end;
$$;

-- Only the service role may call it
revoke all on function public.increment_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, integer) to service_role;
