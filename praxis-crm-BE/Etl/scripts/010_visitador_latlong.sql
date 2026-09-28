-- ============================================================
-- Praxis CRM - Migración: coordenadas de visitadores
-- Agrega latitud y longitud a visitador para ubicar en el mapa
-- al personal técnico en terreno. Mismo tipo NUMERIC(10,7) que
-- ya usa visita.latitud/longitud.
-- ============================================================

ALTER TABLE visitador ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,7);
ALTER TABLE visitador ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,7);