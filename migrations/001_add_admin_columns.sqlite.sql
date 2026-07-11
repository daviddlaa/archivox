-- ============================================================================
-- MIGRACIÓN 001: Panel de Administración (SQLite)
-- Fecha: Julio 2026
-- Descripción: Agrega columnas de seguridad y administración a la tabla
--              usuarios, crea la tabla de auditoría y migra los datos existentes.
--
-- Ejecutar: sqlite3 database.db < migrations/001_add_admin_columns.sqlite.sql
-- ============================================================================

-- ============================================================================
-- PASO 1: Agregar nuevas columnas a la tabla usuarios
-- SQLite no soporta ADD COLUMN IF NOT EXISTS directamente,
-- pero podemos usar la sintaxis simple y manejar el error si ya existe
-- ============================================================================
ALTER TABLE usuarios ADD COLUMN email TEXT UNIQUE;
ALTER TABLE usuarios ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE usuarios ADD COLUMN is_superadmin INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN locked_until TEXT;
ALTER TABLE usuarios ADD COLUMN password_changed_at TEXT DEFAULT (datetime('now'));
ALTER TABLE usuarios ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));

-- ============================================================================
-- PASO 2: Asignar usuario daviddlaa como superadmin
-- ============================================================================
UPDATE usuarios
SET rol = 'admin',
    is_superadmin = 1,
    is_active = 1,
    updated_at = datetime('now')
WHERE username = 'daviddlaa';

-- ============================================================================
-- PASO 3: Asegurar que todos los demás usuarios tengan rol 'user'
-- ============================================================================
UPDATE usuarios
SET rol = 'user',
    is_superadmin = 0,
    is_active = 1,
    email_verified = 0,
    updated_at = datetime('now')
WHERE username != 'daviddlaa'
  AND (rol IS NULL OR rol NOT IN ('admin', 'superadmin'));

-- ============================================================================
-- PASO 4: Crear tabla de auditoría
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id      INTEGER NOT NULL,
    accion          TEXT NOT NULL,
    target_type     TEXT,
    target_id       INTEGER,
    detalle         TEXT,  -- SQLite no tiene JSONB, usamos TEXT
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- ============================================================================
-- PASO 5: Crear índices para rendimiento
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_is_active ON usuarios(is_active);

-- ============================================================================
-- PASO 6: Registrar la migración
-- ============================================================================
INSERT INTO audit_log (usuario_id, accion, target_type, detalle)
SELECT id, 'system.migration', 'database',
       '{"migration": "001_add_admin_columns", "description": "Panel de Administración - Fase 1"}'
FROM usuarios
WHERE username = 'daviddlaa';
