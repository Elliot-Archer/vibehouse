-- RLS policies for Vibehouse
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/oqmhcbfxewpytmgmokhr/sql/new

-- Enable RLS on all tables (may already be on)
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.task_members enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.swap_requests enable row level security;
alter table public.push_subscriptions enable row level security;

-- users: authenticated users can read all, no one can write via API (managed by admin routes)
create policy "Authenticated users can read users"
  on public.users for select
  to authenticated
  using (true);

-- tasks: authenticated users can read all
create policy "Authenticated users can read tasks"
  on public.tasks for select
  to authenticated
  using (true);

-- task_members: authenticated users can read all
create policy "Authenticated users can read task_members"
  on public.task_members for select
  to authenticated
  using (true);

-- schedule_entries: authenticated users can read all, update only their own
create policy "Authenticated users can read schedule_entries"
  on public.schedule_entries for select
  to authenticated
  using (true);

create policy "Users can update their own schedule_entries"
  on public.schedule_entries for update
  to authenticated
  using (user_id = auth.uid());

create policy "Service role can insert schedule_entries"
  on public.schedule_entries for insert
  to authenticated
  with check (true);

-- swap_requests: authenticated users can read all, insert their own, update targeted at them
create policy "Authenticated users can read swap_requests"
  on public.swap_requests for select
  to authenticated
  using (true);

create policy "Users can insert swap_requests as requester"
  on public.swap_requests for insert
  to authenticated
  with check (requester_id = auth.uid());

create policy "Users can update swap_requests targeting them"
  on public.swap_requests for update
  to authenticated
  using (target_id = auth.uid() or requester_id = auth.uid());

create policy "Users can delete their own swap_requests"
  on public.swap_requests for delete
  to authenticated
  using (requester_id = auth.uid());

-- push_subscriptions: users manage their own
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
