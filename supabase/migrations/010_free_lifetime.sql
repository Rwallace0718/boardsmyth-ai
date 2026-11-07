-- The free plan is a one-time allowance (5 generations in total), not a monthly one.
-- It is counted per account (under the fixed date 2000-01-01 in the usage table) AND per computer,
-- so a second email address on the same computer does not give another 5.
-- The computer is identified only by a one-way hash made by the app; the raw computer id never leaves it.
create table if not exists public.free_devices (
  device_hash text primary key,
  count integer not null default 0,
  first_user uuid,
  updated_at timestamptz not null default now()
);
alter table public.free_devices enable row level security; -- no policies: only the service role can read or write it

create or replace function public.increment_free_trial(p_user uuid, p_device text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  user_count integer;
  dev_count integer;
begin
  if p_device is null or length(p_device) < 32 then
    return false;
  end if;

  insert into public.free_devices (device_hash, count, first_user)
  values (p_device, 0, p_user)
  on conflict (device_hash) do nothing;

  select count into dev_count from public.free_devices where device_hash = p_device for update;
  select count into user_count from public.usage where user_id = p_user and day = date '2000-01-01';
  user_count := coalesce(user_count, 0);

  if dev_count >= p_limit or user_count >= p_limit then
    return false;
  end if;

  update public.free_devices set count = count + 1, updated_at = now() where device_hash = p_device;
  insert into public.usage (user_id, day, count)
  values (p_user, date '2000-01-01', 1)
  on conflict (user_id, day) do update set count = public.usage.count + 1;
  return true;
end;
$function$;

revoke all on function public.increment_free_trial(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.increment_free_trial(uuid, text, integer) to service_role;
