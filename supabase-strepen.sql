-- Add strepen column to users table
-- Run this in the Supabase SQL editor

ALTER TABLE public.users ADD COLUMN strepen INTEGER NOT NULL DEFAULT 0;

-- RLS policy: anyone can read all strepen
CREATE POLICY "Authenticated users can read strepen"
  ON public.users for select
  to authenticated
  using (true);

-- RLS policy: only service role (via admin API) can update strepen
CREATE POLICY "Service role can update strepen"
  ON public.users for update
  to authenticated
  using (false)  -- prevent regular users
  with check (false);
