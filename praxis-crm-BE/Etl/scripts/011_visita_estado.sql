-- 011: estado de la visita
-- Estados: 'por_visitar' (creada desde el planificador) | 'realizada' (registrada tras la visita real)
ALTER TABLE public.visita ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'por_visitar';