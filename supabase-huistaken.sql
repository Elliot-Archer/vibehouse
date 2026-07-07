ALTER TABLE public.users ADD COLUMN IF NOT EXISTS huistaak text;

UPDATE public.users SET huistaak = 'Huisrekening'      WHERE name = 'Ties';
UPDATE public.users SET huistaak = 'Doeken'            WHERE name = 'Lone';
UPDATE public.users SET huistaak = 'Bijkeuken'         WHERE name = 'Mathijs';
UPDATE public.users SET huistaak = 'Bakken'            WHERE name = 'Elliot';
UPDATE public.users SET huistaak = 'Ijskast'           WHERE name = 'Victor';
UPDATE public.users SET huistaak = 'Huisbs & biertaak' WHERE name = 'Lucas';
UPDATE public.users SET huistaak = 'Glas & karton'     WHERE name = 'Lotte';
UPDATE public.users SET huistaak = 'Huisbs & biertaak' WHERE name = 'Madelon';
UPDATE public.users SET huistaak = 'Timmerclub'        WHERE name = 'Emile';
UPDATE public.users SET huistaak = 'Huisbs & biertaak' WHERE name = 'Bastiaan';
UPDATE public.users SET huistaak = 'Vuilnis'           WHERE name = 'Annetje';
UPDATE public.users SET huistaak = 'Vuilnis'           WHERE name = 'Eva';
