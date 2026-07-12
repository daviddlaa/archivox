-- ============================================================================
-- MIGRACIÓN 002: Índices compuestos para optimización de rendimiento
-- ============================================================================
-- Fecha: Julio 2026
-- Basado en auditoría de rendimiento y escalabilidad
--
-- Ejecutar en producción (Render PostgreSQL):
--   psql "$DATABASE_URL" -f migrations/002_add_compound_indexes.sql
-- ============================================================================

BEGIN;

-- ================================================================
-- 1. SOLICITUDES
-- ================================================================

-- Listado principal: filtro por usuario + ORDER BY id DESC
-- Cobertura: listarSolicitudes, buscarSolicitudes
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_id_desc
ON solicitudes(usuario_id, id_solicitud DESC);

-- Dashboard: filtro por usuario + GROUP BY estado / SUM(CASE WHEN estado=...)
-- Cobertura: dashboard, dashboardEstados
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_estado
ON solicitudes(usuario_id, estado);

-- Dashboard: filtro por usuario + GROUP BY segmento
-- Cobertura: dashboardSegmentos
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_segmento
ON solicitudes(usuario_id, segmento);

-- Promedios: filtro por usuario + rango de fechas (últimos 90/63 días)
-- Cobertura: dashboardPromedioMes, dashboardPromedioSemana, dashboardVentasMensuales
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario_fecha
ON solicitudes(usuario_id, fecha_solicitud);

-- Búsqueda por cédula exacta (verificación duplicados, búsquedas)
CREATE INDEX IF NOT EXISTS idx_solicitudes_cedula
ON solicitudes(cedula);

-- ================================================================
-- 2. GESTIONES
-- ================================================================

-- LATERAL JOIN: la consulta más frecuente del sistema
-- Cobertura: LATERAL JOIN en listarSolicitudes y buscarSolicitudes
CREATE INDEX IF NOT EXISTS idx_gestiones_solicitud_usuario_fecha
ON gestiones(solicitud_id, usuario_id, fecha_gestion DESC);

-- Dashboard actividad: gestiones en los últimos 7/30 días
CREATE INDEX IF NOT EXISTS idx_gestiones_usuario_created
ON gestiones(usuario_id, created_at);

-- Campañas: consulta de progreso por gestion_maestro_id
CREATE INDEX IF NOT EXISTS idx_gestiones_maestro_id_solicitud
ON gestiones(gestion_maestro_id, solicitud_id);

-- ================================================================
-- 3. NOTIFICACIONES
-- ================================================================

-- Listado de notificaciones por usuario (filtradas por leída)
CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario_leida
ON notificaciones(destinatario_id, leida, created_at DESC);

-- ================================================================
-- 4. HISTORIAL DE ACTUALIZACIONES
-- ================================================================

-- Consulta de historial por usuario ordenado por fecha
CREATE INDEX IF NOT EXISTS idx_historial_usuario_fecha
ON historial_actualizaciones(usuario_id, fecha_actualizacion DESC);

-- ================================================================
-- 5. AUDIT_LOG (índice adicional compuesto)
-- ================================================================

-- Consulta de auditoría (acción + fecha)
CREATE INDEX IF NOT EXISTS idx_audit_log_accion_fecha
ON audit_log(accion, created_at DESC);

COMMIT;

-- ============================================================================
-- VERIFICACIÓN: Listar todos los índices creados
-- ============================================================================
-- Para verificar después de ejecutar:
--   SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN (
--     'solicitudes', 'gestiones', 'notificaciones', 'historial_actualizaciones', 'audit_log'
--   ) ORDER BY tablename, indexname;
-- ============================================================================
