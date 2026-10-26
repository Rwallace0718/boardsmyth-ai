alter table public.subscriptions add column if not exists plan text not null default 'byok' check (plan in ('hosted','byok'));

create or replace function public.increment_usage_monthly(p_user uuid, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  month_key date := date_trunc('month', now() at time zone 'utc')::date;
  new_count integer;
begin
  insert into public.usage (user_id, day, count) values (p_user, month_key, 1)
  on conflict (user_id, day) do update set count = public.usage.count + 1
  returning count into new_count;
  if new_count > p_limit then
    update public.usage set count = count - 1 where user_id = p_user and day = month_key;
    return false;
  end if;
  return true;
end;
$$;
revoke all on function public.increment_usage_monthly(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_usage_monthly(uuid, integer) to service_role;
