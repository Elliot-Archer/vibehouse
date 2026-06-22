-- Notifications table for Tjokkellust
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/oqmhcbfxewpytmgmokhr/sql/new
--
-- Stores a per-user feed of notification events (incoming + outgoing).
-- Rows are written server-side via the service role and read back via the
-- service role too (see src/lib/notifications.ts and the meldingen page), so
-- RLS is enabled with no public policies: anon/authenticated clients get
-- nothing, the service role bypasses RLS. A weekly Vercel cron clears old rows.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  -- whose feed this row belongs to
  user_id uuid not null references public.users(id) on delete cascade,
  -- 'incoming' (user received it) or 'outgoing' (user caused it)
  direction text not null check (direction in ('incoming', 'outgoing')),
  -- event kind, drives the icon: swap_request, swap_accepted, swap_declined,
  -- poke, streep, weekly_reminder, waste_reminder
  type text not null,
  -- the other person involved (sender for incoming, recipient for outgoing);
  -- null for system notifications (weekly reminder, waste, streep)
  actor_id uuid references public.users(id) on delete set null,
  -- the rendered Dutch text shown in the notification center
  body text not null,
  -- where tapping the notification navigates to
  url text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
