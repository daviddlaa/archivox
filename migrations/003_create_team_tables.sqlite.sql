-- ============================================================================
-- MIGRACIÓN 003a: Sistema Multi-Equipo — Creación de tablas (SQLite)
-- ============================================================================
-- Fecha: Julio 2026
-- Descripción: Crea las 6 nuevas tablas para soportar la arquitectura
--              organizacional basada en equipos y modifica gestiones_maestro.
--
-- Orden de ejecución:
--   1. migrations/003_create_team_tables.sqlite.sql   (este archivo)
--   2. migrations/003_seed_team_data.sqlite.sql        (seed data)
--
-- Rollback: migrations/003_rollback_team_tables.sqlite.sql
--
-- Ejecutar: sqlite3 database.db < migrations/003_create_team_tables.sqlite.sql
-- ============================================================================

-- ============================================================================
-- TABLA 1/6: equipos
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre          TEXT UNIQUE NOT NULL,
    descripcion     TEXT,
    activo          INTEGER DEFAULT 1 NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_equipos_activo ON equipos(activo);

-- ============================================================================
-- TABLA 2/6: equipo_usuarios
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipo_usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    equipo_id       INTEGER NOT NULL,
    usuario_id      INTEGER NOT NULL,
    es_lider        INTEGER DEFAULT 0 NOT NULL,
    fecha_ingreso   TEXT DEFAULT (datetime('now')),
    fecha_salida    TEXT,
    motivo_salida   TEXT,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    UNIQUE(usuario_id, fecha_salida)
);

-- Índice único parcial: garantiza un solo registro activo por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipo_usuario_unico_activo
    ON equipo_usuarios(usuario_id) WHERE fecha_salida IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_usuario_activo
    ON equipo_usuarios(usuario_id, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_equipo
    ON equipo_usuarios(equipo_id, es_lider, fecha_salida);
CREATE INDEX IF NOT EXISTS idx_equipo_usuarios_lider
    ON equipo_usuarios(equipo_id, es_lider);

-- ============================================================================
-- TABLA 3/6: permisos_roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS permisos_roles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rol             TEXT NOT NULL,
    permiso         TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    UNIQUE(rol, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_roles_rol ON permisos_roles(rol);

-- ============================================================================
-- TABLA 4/6: permisos_equipo
-- ============================================================================
CREATE TABLE IF NOT EXISTS permisos_equipo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    equipo_id       INTEGER NOT NULL,
    permiso         TEXT NOT NULL,
    concedido_por   INTEGER,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    FOREIGN KEY (concedido_por) REFERENCES usuarios(id),
    UNIQUE(equipo_id, permiso)
);

CREATE INDEX IF NOT EXISTS idx_permisos_equipo_equipo ON permisos_equipo(equipo_id);

-- ============================================================================
-- TABLA 5/6: asignaciones_solicitudes
-- ============================================================================
CREATE TABLE IF NOT EXISTS asignaciones_solicitudes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitud_id        INTEGER NOT NULL,
    equipo_id           INTEGER NOT NULL,
    usuario_id          INTEGER,
    asignado_por        INTEGER NOT NULL,
    desde_campaña_id    INTEGER,
    tipo_asignacion     TEXT DEFAULT 'manual',
    fecha_asignacion    TEXT DEFAULT (datetime('now')),
    fecha_desasignacion TEXT,
    motivo_desasignacion TEXT,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (asignado_por) REFERENCES usuarios(id),
    UNIQUE(solicitud_id, fecha_desasignacion)
);

CREATE INDEX IF NOT EXISTS idx_asignaciones_solicitud_activa
    ON asignaciones_solicitudes(solicitud_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario_activas
    ON asignaciones_solicitudes(usuario_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_equipo_activas
    ON asignaciones_solicitudes(equipo_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_campaña
    ON asignaciones_solicitudes(desde_campaña_id, fecha_desasignacion);
CREATE INDEX IF NOT EXISTS idx_asignaciones_fecha
    ON asignaciones_solicitudes(fecha_asignacion DESC);

-- ============================================================================
-- TABLA 6/6: campañas_equipo
-- ============================================================================
CREATE TABLE IF NOT EXISTS campañas_equipo (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    campaña_id      INTEGER NOT NULL,
    equipo_id       INTEGER NOT NULL,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
    UNIQUE(campaña_id)
);

CREATE INDEX IF NOT EXISTS idx_campañas_equipo_equipo ON campañas_equipo(equipo_id);

-- ============================================================================
-- MODIFICACIÓN: gestiones_maestro + equipo_id
-- ============================================================================
ALTER TABLE gestiones_maestro ADD COLUMN equipo_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_equipo
    ON gestiones_maestro(equipo_id);
