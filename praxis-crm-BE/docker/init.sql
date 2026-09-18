-- ============================================================
-- Praxis CRM - Inicialización de base de datos
-- Generado desde DBML schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Ciudad
-- ============================================================
CREATE TABLE ciudad (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    status BOOLEAN DEFAULT true
);

-- ============================================================
-- Persona
-- ============================================================
CREATE TABLE persona (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    primer_apellido VARCHAR(255) NOT NULL,
    segundo_apellido VARCHAR(255),
    sexo VARCHAR(20) DEFAULT '',
    correo VARCHAR(255),
    telefono VARCHAR(50),
    nacimiento DATE,
    ci VARCHAR(50),
    ciudad_id INTEGER REFERENCES ciudad(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status BOOLEAN DEFAULT true
);

CREATE INDEX idx_persona_correo ON persona(correo);
CREATE INDEX idx_persona_ci ON persona(ci);
CREATE INDEX idx_persona_ciudad ON persona(ciudad_id);

-- ============================================================
-- Especialidad
-- ============================================================
CREATE TABLE especialidad (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    status BOOLEAN DEFAULT true
);

-- ============================================================
-- Laboratorio (pruebas de laboratorio / estudios)
-- ============================================================
CREATE TABLE laboratorio (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    area VARCHAR(150) NOT NULL,
    precio NUMERIC(10,2) NOT NULL DEFAULT 0,
    comision_extra NUMERIC(5,2) NOT NULL DEFAULT 0,
    status BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_laboratorio_area ON laboratorio(area);

-- ============================================================
-- costo por ciudad (intersección laboratorio <-> ciudad)
-- 0 = no disponible en esa ciudad
-- ============================================================
CREATE TABLE laboratorio_ciudad (
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorio(id) ON DELETE CASCADE,
    ciudad_id INTEGER NOT NULL REFERENCES ciudad(id) ON DELETE CASCADE,
    costo NUMERIC(10,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (laboratorio_id, ciudad_id)
);

CREATE INDEX idx_lab_ciudad_ciudad ON laboratorio_ciudad(ciudad_id);

-- ============================================================
-- Medico (extiende Persona)
-- ============================================================
CREATE TABLE medico (
    persona_id INTEGER PRIMARY KEY REFERENCES persona(id) ON DELETE CASCADE,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    especialidad_id INTEGER REFERENCES especialidad(id) ON DELETE SET NULL,
    visitador_id INTEGER REFERENCES visitador(persona_id) ON DELETE SET NULL,
    es_particular BOOLEAN DEFAULT false,
    institucion VARCHAR(255),
    direccion JSONB DEFAULT '{}',
    clasificacion SMALLINT DEFAULT 0 CHECK (clasificacion BETWEEN 0 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    frecuencia_visita VARCHAR(100),
    notas JSONB DEFAULT '{}',
    status BOOLEAN DEFAULT true
);

CREATE INDEX idx_medico_especialidad ON medico(especialidad_id);
CREATE INDEX idx_medico_codigo ON medico(codigo);

-- ============================================================
-- Accion
-- ============================================================
CREATE TABLE accion (
    id SERIAL PRIMARY KEY,
    nombre_accion VARCHAR(255) NOT NULL,
    ciudad JSONB DEFAULT '{}',
    detalle TEXT,
    impacto_esperado TEXT,
    prioridad SMALLINT DEFAULT 0 CHECK (prioridad BETWEEN 0 AND 3),
    status BOOLEAN DEFAULT true
);

-- ============================================================
-- Visitador (extiende Persona)
-- ============================================================
CREATE TABLE visitador (
    persona_id INTEGER PRIMARY KEY REFERENCES persona(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status BOOLEAN DEFAULT true
);

-- ============================================================
-- VisitadorMedico (tabla de relación visitas)
-- ============================================================
CREATE TABLE visitador_medico (
    id SERIAL PRIMARY KEY,
    id_visitador INTEGER NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
    id_medico INTEGER NOT NULL REFERENCES medico(persona_id) ON DELETE CASCADE,
    fecha_visita TIMESTAMPTZ DEFAULT NOW(),
    fecha_visita_tentativa TIMESTAMPTZ,
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    firma TEXT DEFAULT '',
    observacion JSONB DEFAULT '{}',
    satisfaccion SMALLINT DEFAULT 0 CHECK (satisfaccion BETWEEN 0 AND 5),
    duracion SMALLINT DEFAULT 0,
    ingreso DECIMAL(10,2) DEFAULT 0,
    papeleta INTEGER DEFAULT 0
);

CREATE INDEX idx_vm_visitador ON visitador_medico(id_visitador);
CREATE INDEX idx_vm_medico ON visitador_medico(id_medico);
CREATE INDEX idx_vm_fecha ON visitador_medico(fecha_visita);

-- ============================================================
-- Users (auth JWT) - hereda datos de persona
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    persona_id INTEGER UNIQUE REFERENCES persona(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'visitador' CHECK (role IN ('admin', 'visitador')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_persona ON users(persona_id);
