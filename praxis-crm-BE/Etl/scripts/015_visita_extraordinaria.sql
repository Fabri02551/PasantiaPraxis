-- 015: marca de visita extraordinaria
--
-- Distingue una visita extraordinaria (se registra en campo, sin fecha
-- tentativa) de una programada. NO se deduce de "no tiene fecha tentativa":
-- esa columna la escribe el service al completar, no el planificador, así que
-- deducirlo sería frágil.
ALTER TABLE public.visita ADD COLUMN IF NOT EXISTS extraordinaria BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_visita_extraordinaria ON public.visita(extraordinaria)
    WHERE extraordinaria;
