-- ============================================================================
-- MIGRACIÓN 003a: Sistema Multi-Equipo — Rollback (SQLite)
-- ============================================================================
-- ADVERTENCIA: Esto ELIMINA todas las tablas nuevas y sus datos.
-- Solo ejecutar si es necesario revertir completamente la migración.
--
-- Ejecutar: sqlite3 database.db < migrations/003_rollback_team_tables.sqlite.sql
-- ============================================================================

DROP INDEX IF EXISTS idx_gestiones_maestro_equipo;
ALTER TABLE gestiones_maestro DROP COLUMN equipo_id;

DROP TABLE IF EXISTS campañas_equipo;
DROP TABLE IF EXISTS asignaciones_solicitudes;
DROP TABLE IF EXISTS permisos_equipo;
DROP TABLE IF EXISTS permisos_roles;
DROP TABLE IF EXISTS equipo_usuarios;
DROP TABLE IF EXISTS equipos;
