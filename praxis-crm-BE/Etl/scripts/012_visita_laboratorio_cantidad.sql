-- 012: cantidad de estudios en una visita (cotización por laboratorio)
ALTER TABLE public.visita_laboratorio ADD COLUMN IF NOT EXISTS cantidad INTEGER NOT NULL DEFAULT 1;