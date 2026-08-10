-- ============================================================================
-- MIGRACIÓN 001: Panel de Administración
-- Fecha: Julio 2026
-- Descripción: Agrega columnas de seguridad y administración a la tabla
--              usuarios, crea la tabla de auditoría y migra los datos existentes.
--
-- Ejecutar: psql -d tu_db -f migrations/001_add_admin_columns.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Agregar nuevas columnas a la tabla usuarios
-- ============================================================================
ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS email              TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active          BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_superadmin      BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMP,
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- PASO 2: Renombrar ultimo_login a last_login para consistencia
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'usuarios' AND column_name = 'ultimo_login'
    ) THEN
        ALTER TABLE usuarios RENAME COLUMN ultimo_login TO last_login;
    END IF;
END $$;

-- ============================================================================
-- PASO 3: Asignar usuario daviddlaa como superadmin
-- ============================================================================
UPDATE usuarios
SET rol = 'admin',
    is_superadmin = TRUE,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE username = 'daviddlaa';

-- ============================================================================
-- PASO 4: Asegurar que todos los demás usuarios tengan rol 'user' y estén activos
-- ============================================================================
UPDATE usuarios
SET rol = 'user',
    is_superadmin = FALSE,
    is_active = TRUE,
    email_verified = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE username != 'daviddlaa'
  AND (rol IS NULL OR rol NOT IN ('admin', 'superadmin'));

-- ============================================================================
-- PASO 5: Crear tabla de auditoría
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    accion          TEXT NOT NULL,
    target_type     TEXT,
    target_id       INTEGER,
    detalle         JSONB,
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PASO 6: Crear índices para rendimiento
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_is_active ON usuarios(is_active);
CREATE INDEX IF NOT EXISTS idx_usuarios_locked ON usuarios(locked_until)
    WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log(accion);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- PASO 7: Registrar la migración en la auditoría (si existe usuario admin)
-- ============================================================================
INSERT INTO audit_log (usuario_id, accion, target_type, detalle)
SELECT id, 'system.migration', 'database',
       '{"migration": "001_add_admin_columns", "description": "Panel de Administración - Fase 1"}'
FROM usuarios
WHERE username = 'daviddlaa'
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log');

COMMIT;
