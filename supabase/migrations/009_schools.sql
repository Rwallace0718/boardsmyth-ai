-- Schools plan: a teacher buys seats, students join one class with a code, projects are shared inside the class only.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('hosted','byok','school'));
alter table public.subscriptions add column if not exists seats integer not null default 0;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists class_members_class on public.class_members(class_id);

create table if not exists public.class_projects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author text not null,
  title text not null check (char_length(title) between 1 and 80),
  board_name text,
  fqbn text,
  code text not null check (char_length(code) <= 30000),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists class_projects_class on public.class_projects(class_id, created_at desc);

-- Everything goes through the "classes" edge function (service role). No direct table access for apps.
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.class_projects enable row level security;

-- Lets the app ask "do I get hosted AI through a class, and which class?" for the signed-in user only.
create or replace function public.my_class_access()
returns table(role text, class_name text, active boolean)
language sql security definer set search_path = public as $$
  select 'student'::text, c.name,
         exists (select 1 from subscriptions s where s.user_id = c.teacher_id and s.plan = 'school'
                 and s.status in ('active','trialing') and (s.current_period_end is null or s.current_period_end > now()))
    from class_members m join classes c on c.id = m.class_id where m.user_id = auth.uid()
  union all
  select 'teacher'::text, c.name, true from classes c where c.teacher_id = auth.uid()
$$;
revoke all on function public.my_class_access() from public, anon;
grant execute on function public.my_class_access() to authenticated;
