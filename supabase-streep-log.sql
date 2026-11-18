-- Strepen-logboek voor Tjokkellust
-- Eenmalig uitvoeren in de Supabase SQL editor:
-- https://supabase.com/dashboard/project/oqmhcbfxewpytmgmokhr/sql/new
--
-- Elke uitgedeelde streep krijgt hier een regel met wie hem gaf, aan wie,
-- en waarom. Beheerders kunnen een streep ongedaan maken: de regel blijft
-- dan staan maar krijgt undone_at/undone_by ingevuld.
--
-- De app leest en schrijft deze tabel alleen via de service role (server-side),
-- net als public.notifications. RLS staat aan zonder policies, dus gewone
-- clients kunnen er niets mee; de service role omzeilt RLS.
-- Bestaande tabellen worden niet aangepast.

create table if not exists public.streep_log (
  id uuid primary key default gen_random_uuid(),
  -- wie de streep kreeg
  user_id uuid not null references public.users(id) on delete cascade,
  -- wie de streep gaf
  giver_id uuid references public.users(id) on delete set null,
  -- verplichte reden
  reason text not null check (char_length(btrim(reason)) between 1 and 200),
  created_at timestamptz not null default now(),
  -- ingevuld als een beheerder de streep ongedaan heeft gemaakt
  undone_at timestamptz,
  undone_by uuid references public.users(id) on delete set null
);

create index if not exists streep_log_created_idx
  on public.streep_log (created_at desc);

alter table public.streep_log enable row level security;
