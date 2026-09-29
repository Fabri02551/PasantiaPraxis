-- 013: fecha_visita solo cuando la visita es real
-- Al crear (planificador) solo existe fecha_visita_tentativa; fecha_visita se
-- escribe en POST /api/visitas/{id}/registrar.
ALTER TABLE public.visita ALTER COLUMN fecha_visita DROP DEFAULT;

-- Limpia el valor NOW() que el default dejó en visitas no registradas.
UPDATE public.visita SET fecha_visita = NULL WHERE registrada = false;

CREATE INDEX IF NOT EXISTS idx_vm_fecha_tentativa ON public.visita(fecha_visita_tentativa);
