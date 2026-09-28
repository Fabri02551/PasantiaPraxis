-- ============================================================
-- Praxis CRM - Migración: cartera medicos + visitas extendidas
-- Agrega es_particular y visitador_id a medico, nuevas columnas
-- a visita y crea laboratorio / laboratorio_ciudad.
-- ============================================================

-- Medico: es_particular + visitador asignado (cartera)
ALTER TABLE medico ADD COLUMN IF NOT EXISTS es_particular BOOLEAN DEFAULT false;
ALTER TABLE medico ADD COLUMN IF NOT EXISTS visitador_id INTEGER REFERENCES visitador(persona_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_medico_visitador ON medico(visitador_id);

-- Visita: visita extendida
ALTER TABLE visita ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE visita ADD COLUMN IF NOT EXISTS fecha_visita_tentativa TIMESTAMPTZ;
ALTER TABLE visita ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,7);
ALTER TABLE visita ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,7);
ALTER TABLE visita ADD COLUMN IF NOT EXISTS firma TEXT DEFAULT '';
ALTER TABLE visita ADD COLUMN IF NOT EXISTS institucion_id INTEGER REFERENCES institucion(id) ON DELETE SET NULL;

-- La PK compuesta (visitador, medico, fecha) se reemplaza por id serial
ALTER TABLE visita DROP CONSTRAINT IF EXISTS visita_pkey;
ALTER TABLE visita DROP CONSTRAINT IF EXISTS visitador_medico_pkey;
ALTER TABLE visita ADD PRIMARY KEY (id);

-- Laboratorio / costos por ciudad (no creadas en BD existente)
CREATE TABLE IF NOT EXISTS laboratorio (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    area VARCHAR(150) NOT NULL,
    precio NUMERIC(10,2) NOT NULL DEFAULT 0,
    comision_extra NUMERIC(5,2) NOT NULL DEFAULT 0,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS laboratorio_ciudad (
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorio(id) ON DELETE CASCADE,
    ciudad_id INTEGER NOT NULL REFERENCES ciudad(id) ON DELETE CASCADE,
    costo NUMERIC(10,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (laboratorio_id, ciudad_id)
);