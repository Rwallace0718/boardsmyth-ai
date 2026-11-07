-- The free plan is a one-time allowance (5 generations in total), not a monthly one.
-- The running total is kept in the usage table under the fixed date 2000-01-01.
create or replace function public.increment_usage_lifetime(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_count integer;
begin
  insert into public.usage (user_id, day, count)
  values (p_user, date '2000-01-01', 1)
  on conflict (user_id, day)
  do update set count = public.usage.count + 1
  returning count into new_count;

  if new_count > p_limit then
    update public.usage
      set count = count - 1
      where user_id = p_user and day = date '2000-01-01';
    return false;
  end if;
  return true;
end;
$function$;

revoke all on function public.increment_usage_lifetime(uuid, integer) from public, anon, authenticated;
grant execute on function public.increment_usage_lifetime(uuid, integer) to service_role;
