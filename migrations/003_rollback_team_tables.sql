-- ============================================================================
-- MIGRACIÓN 003a: Sistema Multi-Equipo — Rollback
-- ============================================================================
-- ADVERTENCIA: Esto ELIMINA todas las tablas nuevas y sus datos.
-- Solo ejecutar si es necesario revertir completamente la migración.
--
-- Ejecutar: psql -d tu_db -f migrations/003_rollback_team_tables.sql
-- ============================================================================

BEGIN;

-- Eliminar índices únicos parciales primero
DROP INDEX IF EXISTS idx_equipo_usuario_unico_activo;

-- Eliminar columna de gestiones_maestro
DROP INDEX IF EXISTS idx_gestiones_maestro_equipo;
ALTER TABLE gestiones_maestro DROP COLUMN IF EXISTS equipo_id;

-- Eliminar tablas nuevas (orden inverso por foreign keys)
DROP TABLE IF EXISTS campañas_equipo CASCADE;
DROP TABLE IF EXISTS asignaciones_solicitudes CASCADE;
DROP TABLE IF EXISTS permisos_equipo CASCADE;
DROP TABLE IF EXISTS permisos_roles CASCADE;
DROP TABLE IF EXISTS equipo_usuarios CASCADE;
DROP TABLE IF EXISTS equipos CASCADE;

COMMIT;
