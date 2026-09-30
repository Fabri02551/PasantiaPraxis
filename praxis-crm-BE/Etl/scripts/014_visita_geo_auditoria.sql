-- 014: auditoría geográfica de la visita
--
-- Separa los DOS conceptos que antes se confundían en un solo par de columnas:
--
--   1. DÓNDE SE HIZO LA VISITA -> ubicacion_destino_id + snapshot del destino
--      Un médico puede tener varias ubicaciones (consultorios). En cada visita
--      hay que saber en cuál se estuvo. El snapshot (destino_*) congela el
--      texto y el pin: si un admin edita después la ficha del médico, el
--      histórico NO debe cambiar.
--
--   2. DÓNDE ESTABA EL VISITADOR -> latitud / longitud
--      GPS del visitador en el momento de completar la visita. Es el insumo
--      del plan de contingencia/auditoría: permite comparar contra el pin del
--      destino y calcular la distancia.
--
-- distancia_destino_m se calcula en el servidor (haversine) a partir del GPS
-- recibido y del pin del destino. NO se acepta del cliente: si la calculara el
-- navegador, el visitador podría reportar la distancia que quiera y la
-- auditoría no valdría nada.
--
-- sin_evidencia_ubicacion: el visitador denegó el permiso de GPS (o el
-- dispositivo no lo dio). La visita se registra igual para no bloquear el
-- trabajo en terreno, pero queda marcada para que el admin la revise.
--
-- gps_precision_m: precisión reportada por el dispositivo (metros). Un GPS con
-- precisión de 3 km no es evidencia de nada; guardarla permite que la auditoría
-- descarte lecturas pobres en vez de confiar a ciegas.

ALTER TABLE public.visita
    ADD COLUMN IF NOT EXISTS ubicacion_destino_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS destino_direccion  TEXT,
    ADD COLUMN IF NOT EXISTS destino_latitud    NUMERIC(10,7),
    ADD COLUMN IF NOT EXISTS destino_longitud   NUMERIC(10,7),
    ADD COLUMN IF NOT EXISTS gps_precision_m     NUMERIC(8,1),
    ADD COLUMN IF NOT EXISTS distancia_destino_m NUMERIC(10,1),
    ADD COLUMN IF NOT EXISTS sin_evidencia_ubicacion BOOLEAN NOT NULL DEFAULT false;

-- Las columnas latitud/longitud de visita son el GPS DEL VISITADOR, no la
-- dirección del médico (esa vive en medico.direccion->coords). Se documentan
-- para que nadie las reutilice con otro sentido.
COMMENT ON COLUMN public.visita.latitud IS
    'GPS del visitador (lat) al completar la visita. NULL si no se capturó. No es la dirección del destino.';
COMMENT ON COLUMN public.visita.longitud IS
    'GPS del visitador (lon) al completar la visita. NULL si no se capturó. No es la dirección del destino.';
COMMENT ON COLUMN public.visita.ubicacion_destino_id IS
    'id de la ubicación del destino (dentro de medico.direccion[] / institucion.direccion[]) donde se hizo la visita';
COMMENT ON COLUMN public.visita.destino_direccion IS
    'Snapshot del texto de la dirección del destino al momento de la visita (inmutable para auditoría)';
COMMENT ON COLUMN public.visita.distancia_destino_m IS
    'Metros entre el GPS del visitador y el pin del destino, calculada en el servidor. NULL si falta alguno de los dos';

-- Búsquedas del panel de auditoría: cuánto se alejó el visitador del destino
-- y cuáles visitas quedaron sin evidencia de ubicación.
CREATE INDEX IF NOT EXISTS idx_visita_sin_evidencia ON public.visita(sin_evidencia_ubicacion)
    WHERE sin_evidencia_ubicacion;
CREATE INDEX IF NOT EXISTS idx_visita_ubicacion_destino ON public.visita(ubicacion_destino_id);
