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
    sexo VARCHAR(20) NOT NULL DEFAULT '',
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
    creado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    modificado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    ultima_modificacion TIMESTAMPTZ DEFAULT NOW()
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
-- Visitador (extiende Persona) - debe existir antes que medico
-- ============================================================
CREATE TABLE visitador (
    persona_id INTEGER PRIMARY KEY REFERENCES persona(id) ON DELETE CASCADE,
    activo BOOLEAN DEFAULT true,
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    creado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    modificado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    ultima_modificacion TIMESTAMPTZ DEFAULT NOW(),
    status BOOLEAN DEFAULT true
);

-- ============================================================
-- Medico (extiende Persona)
-- ============================================================
CREATE TABLE medico (
    persona_id INTEGER PRIMARY KEY REFERENCES persona(id) ON DELETE CASCADE,
    codigo VARCHAR(50) UNIQUE,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    especialidad_id INTEGER NOT NULL REFERENCES especialidad(id) ON DELETE RESTRICT,
    visitador_id INTEGER REFERENCES visitador(persona_id) ON DELETE SET NULL,
    es_particular BOOLEAN NOT NULL DEFAULT false,
    direccion JSONB DEFAULT '{}',
    clasificacion SMALLINT DEFAULT 0 CHECK (clasificacion BETWEEN 0 AND 5),
    frecuencia_visita VARCHAR(100),
    notas JSONB DEFAULT '{}',
    status BOOLEAN DEFAULT true,
    creado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    modificado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    ultima_modificacion TIMESTAMPTZ DEFAULT NOW()
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
-- Institucion (clínicas/hospitales que visita la fuerza de ventas)
-- Entidad independiente de medico. Debe existir antes que visita.
-- ============================================================
CREATE TABLE institucion (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    razon_social VARCHAR(255) DEFAULT '',
    direccion JSONB DEFAULT '{}',
    telefono VARCHAR(50) DEFAULT '',
    correo VARCHAR(255) DEFAULT '',
    tipo_contrato VARCHAR(100) DEFAULT '',
    nit VARCHAR(50) DEFAULT '',
    visitador_id INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    ciudad_id INTEGER REFERENCES ciudad(id) ON DELETE SET NULL,
    es_particular BOOLEAN NOT NULL DEFAULT false,
    clasificacion SMALLINT DEFAULT 0 CHECK (clasificacion BETWEEN 0 AND 5),
    status BOOLEAN DEFAULT true,
    creado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    modificado_por INTEGER REFERENCES persona(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    ultima_modificacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_institucion_ciudad ON institucion(ciudad_id);
CREATE INDEX idx_institucion_visitador ON institucion(visitador_id);

-- ============================================================
-- Visita (visita programada por admin y registrada por visitador)
-- id_medico opcional: si la visita es a un médico concreto.
-- institucion_id opcional: si la visita es a una institución.
-- ============================================================
CREATE TABLE visita (
    id SERIAL PRIMARY KEY,
    id_visitador INTEGER NOT NULL REFERENCES persona(id) ON DELETE CASCADE,
    id_medico INTEGER REFERENCES medico(persona_id) ON DELETE CASCADE,
    institucion_id INTEGER REFERENCES institucion(id) ON DELETE SET NULL,
    fecha_visita TIMESTAMPTZ DEFAULT NOW(),
    fecha_visita_tentativa TIMESTAMPTZ,
    latitud NUMERIC(10,7),
    longitud NUMERIC(10,7),
    firma TEXT DEFAULT '',
    observacion JSONB DEFAULT '{}',
    satisfaccion SMALLINT DEFAULT 0 CHECK (satisfaccion BETWEEN 0 AND 5),
    duracion SMALLINT DEFAULT 0,
    ingreso DECIMAL(10,2) DEFAULT 0,
    papeleta INTEGER DEFAULT 0,
    registrada BOOLEAN DEFAULT false
);

CREATE INDEX idx_vm_visitador ON visita(id_visitador);
CREATE INDEX idx_vm_medico ON visita(id_medico);
CREATE INDEX idx_vm_institucion ON visita(institucion_id);
CREATE INDEX idx_vm_fecha ON visita(fecha_visita);

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

-- ============================================================
-- VisitaLaboratorio (intersección visita <-> estudios solicitados)
-- costo: precio cobrado en la visita (según la ciudad del médico o de la
-- institución y comisión si es particular), calculado al agregar el estudio.
-- ============================================================
CREATE TABLE visita_laboratorio (
    visita_id INTEGER NOT NULL REFERENCES visita(id) ON DELETE CASCADE,
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorio(id) ON DELETE CASCADE,
    costo NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (visita_id, laboratorio_id)
);

CREATE INDEX idx_vl_laboratorio ON visita_laboratorio(laboratorio_id);
