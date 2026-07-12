-- ============================================================================
-- MIGRACIÓN 003a: Sistema Multi-Equipo — Creación de tablas
-- ============================================================================
-- Fecha: Julio 2026
-- Descripción: Crea las 6 nuevas tablas para soportar la arquitectura
--              organizacional basada en equipos: equipos, equipo_usuarios,
--              permisos_roles, permisos_equipo, asignaciones_solicitudes,
--              campañas_equipo. Además agrega columna equipo_id a
--              gestiones_maestro.
--
-- Orden de ejecución:
--   1. migrations/003_create_team_tables.pg.sql   (este archivo)
--   2. migrations/003_seed_team_data.sql           (seed data)
--
-- Rollback: migrations/003_rollback_team_tables.sql
--
-- Ejecutar: psql -d tu_db -f migrations/003_create_team_tables.pg.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLA 1/6: equipos
-- Catálogo de equipos organizacionales. No se eliminan, solo se desactivan.
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) UNIQUE NOT NULL,
    descripcion     TEXT,
    activo          INTEGER DEFAULT 1 NOT NULL CHECK (activo IN (0, 1)),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo);

-- ============================================================================
-- TABLA 2/6: equipo_usuarios
-- Membresía de usuarios en equipos. Soporta historial (fecha_salida).
-- Un usuario activo pertenece a un solo equipo (UNIQUE usuario_id + fecha_salida IS NULL).
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipo_usuarios (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    es_lider        INTEGER DEFAULT 0 NOT NULL CHECK (es_lider IN (0, 1)),
    fecha_ingreso   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_salida    TIMESTAMP,
    motivo_salida   TEXT,
    UNIQUE(usuario_id, fecha_salida)
);

-- Índice único parcial: garantiza un solo registro activo por usuario
-- (NULLs son distintos en UNIQUE, por eso se requiere índice parcial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipo_usuario_unico_activo
    ON equipo_usuarios(usuario_id) WHERE fecha_salida IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario_activo
    ON equipo_usuarios(usuario_id, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo
    ON equipo_usuarios(equipo_id, es_lider, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_lider
    ON equipo_usuarios(equipo_id, es_lider) WHERE es_lider = 1 AND fecha_salida IS NULL;

-- ============================================================================
-- TABLA 3/6: permisos_roles
-- Define qué permisos tiene cada rol del sistema. Sistema extensible:
-- agregar un nuevo permiso es solo un INSERT.
-- superadmin y admin tienen permisos implícitos (no necesitan registros aquí).
-- ============================================================================
CREATE TABLE IF NOT EXISTS permisos_roles (
    id              SERIAL PRIMARY KEY,
    rol             VARCHAR(20) NOT NULL,
    permiso         VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rol, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_roles_rol ON permisos_roles(rol);

-- ============================================================================
-- TABLA 4/6: permisos_equipo
-- Permisos extra que un SUPERADMIN puede conceder a un equipo completo,
-- por encima de los permisos de su rol base.
-- ============================================================================
CREATE TABLE IF NOT EXISTS permisos_equipo (
    id              SERIAL PRIMARY KEY,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    permiso         VARCHAR(100) NOT NULL,
    concedido_por   INTEGER REFERENCES usuarios(id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(equipo_id, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_equipo_equipo ON permisos_equipo(equipo_id);

-- ============================================================================
-- TABLA 5/6: asignaciones_solicitudes
-- Corazón del sistema multi-equipo. Registra qué solicitudes están asignadas
-- a qué equipo y opcionalmente a qué agente específico.
-- Las solicitudes NO se duplican ni modifican. Solo se asignan.
-- ============================================================================
CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
    id                  SERIAL PRIMARY KEY,
    solicitud_id        INTEGER NOT NULL,
    equipo_id           INTEGER NOT NULL REFERENCES equipos(id),
    usuario_id          INTEGER REFERENCES usuarios(id),
    asignado_por        INTEGER NOT NULL REFERENCES usuarios(id),
    desde_campaña_id    INTEGER,
    tipo_asignacion     VARCHAR(20) DEFAULT 'manual'
                        CHECK (tipo_asignacion IN ('manual', 'automatica', 'campaña', 'importacion')),
    fecha_asignacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_desasignacion TIMESTAMP,
    motivo_desasignacion TEXT,
    UNIQUE(solicitud_id, fecha_desasignacion)
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa
    ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas
    ON asignaciones_solicitudes(usuario_id, fecha_desasignacion) WHERE usuario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas
    ON asignaciones_solicitudes(equipo_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_campaña
    ON asignaciones_solicitudes(desde_campaña_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha
    ON asignaciones_solicitudes(fecha_asignacion DESC);

-- ============================================================================
-- TABLA 6/6: campañas_equipo
-- Asocia campañas (gestiones_maestro) a equipos.
-- La asociación principal también se refleja en gestiones_maestro.equipo_id.
-- ============================================================================
CREATE TABLE IF NOT EXISTS campañas_equipo (
    id              SERIAL PRIMARY KEY,
    campaña_id      INTEGER NOT NULL,
    equipo_id       INTEGER NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaña_id)
);

CREATE INDEX IF NOT EXISTS idx_campañas_equipo_equipo ON campañas_equipo(equipo_id);

-- ============================================================================
-- MODIFICACIÓN: gestiones_maestro + equipo_id
-- Columna nullable para asociar campañas a equipos.
-- NULL = campaña global (comportamiento actual).
-- ============================================================================
ALTER TABLE gestiones_maestro
ADD COLUMN IF NOT EXISTS equipo_id INTEGER REFERENCES equipos(id);

CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo
    ON gestiones_maestro(equipo_id);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Para verificar después de ejecutar:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN (
--     'equipos', 'equipo_usuarios', 'permisos_roles', 'permisos_equipo',
--     'asignaciones_solicitudes', 'campañas_equipo'
--   );
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'gestiones_maestro' AND column_name = 'equipo_id';

COMMIT;
