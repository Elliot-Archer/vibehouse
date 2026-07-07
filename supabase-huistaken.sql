-- Huistaak (household task) per person.
-- Run in the Supabase SQL editor.
--
-- NOTE: users.name holds an editable nickname (e.g. "EDGE", "Regiel"), so it is
-- NOT reliable for matching. We key on email, which is stable. The comment after
-- each line is the person's real name for readability.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS huistaak text;

UPDATE public.users SET huistaak = 'Huisrekening'      WHERE lower(email) = 'ties@onderdelinden.com';      -- Ties
UPDATE public.users SET huistaak = 'Doeken'            WHERE lower(email) = 'lone.beernink@gmail.com';      -- Lone
UPDATE public.users SET huistaak = 'Bijkeuken'         WHERE lower(email) = 'vanderdriftmathijs@gmail.com'; -- Mathijs
UPDATE public.users SET huistaak = 'Bakken'            WHERE lower(email) = 'elliotjustinarcher@gmail.com'; -- Elliot
UPDATE public.users SET huistaak = 'Ijskast'           WHERE lower(email) = 'victorsimons59@gmail.com';     -- Victor
UPDATE public.users SET huistaak = 'Huisbs & biertaak' WHERE lower(email) = 'lzondervan27@gmail.com';       -- Lucas
UPDATE public.users SET huistaak = 'Glas & karton'     WHERE lower(email) = 'lottevanzanten123@gmail.com';  -- Lotte
UPDATE public.users SET huistaak = 'Huisbs & biertaak' WHERE lower(email) = 'verheijenmadelon@gmail.com';   -- Madelon
UPDATE public.users SET huistaak = 'Timmerclub'        WHERE lower(email) = 'mail@emilebol.nl';             -- Emile
UPDATE public.users SET huistaak = 'Huisbs & biertaak' WHERE lower(email) = 'bastiaanprins@outlook.com';    -- Bastiaan
UPDATE public.users SET huistaak = 'Vuilnis'           WHERE lower(email) = 'annetje.schoop@gmail.com';     -- Annetje
UPDATE public.users SET huistaak = 'Vuilnis'           WHERE lower(email) = 'eva.ten.hoor@outlook.com';     -- Eva
