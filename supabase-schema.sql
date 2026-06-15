-- Vibehouse schema
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/oqmhcbfxewpytmgmokhr/sql/new

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists public.task_members (
  task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  "order" integer not null,
  primary key (task_id, user_id)
);

create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  week date not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  unique (task_id, week)
);

create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.users(id) on delete cascade,
  target_id uuid references public.users(id) on delete cascade,
  entry_id uuid references public.schedule_entries(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined'))
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique,
  subscription jsonb not null
);

-- Insert your user profile (links your Supabase auth account to the users table)
insert into public.users (id, name, email)
values (
  gen_random_uuid(),
  'Elliot',
  'elliotjustinarcher@gmail.com'
)
on conflict (email) do nothing;
