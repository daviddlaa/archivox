-- ============================================================================
-- MIGRACIÓN 003b: Sistema Multi-Equipo — Seed Data
-- ============================================================================
-- Fecha: Julio 2026
-- Descripción: Puebla las tablas del sistema multi-equipo con datos iniciales:
--   1. Crea el equipo "Sistema" (equipo por defecto post-migración)
--   2. Asigna todos los usuarios actuales al equipo Sistema
--   3. Inserta permisos para los roles lider, agente y user
--
-- Requiere ejecutar ANTES: migrations/003_create_team_tables.pg.sql
--
-- Ejecutar: psql -d tu_db -f migrations/003_seed_team_data.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Crear equipo "Sistema"
-- Equipo transitorio para que ningún usuario quede huérfano.
-- ============================================================================
INSERT INTO equipos (nombre, descripcion)
SELECT 'Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.'
WHERE NOT EXISTS (SELECT 1 FROM equipos WHERE nombre = 'Sistema');

-- ============================================================================
-- PASO 2: Asignar usuarios al equipo Sistema
-- 2a. SUPERADMIN como líder del equipo
-- ============================================================================
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 1
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.is_superadmin = TRUE)
  AND NOT EXISTS (
    SELECT 1 FROM equipo_usuarios eu
    WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
  );

-- 2b. ADMIN como miembros del equipo
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND u.rol = 'admin'
  AND (u.is_superadmin IS NULL OR u.is_superadmin = FALSE)
  AND NOT EXISTS (
    SELECT 1 FROM equipo_usuarios eu
    WHERE eu.usuario_id = u.id AND eu.fecha_salida IS NULL
  );

-- 2c. Demás usuarios como miembros
INSERT INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
  AND u.id NOT IN (
    SELECT eu.usuario_id FROM equipo_usuarios eu WHERE eu.fecha_salida IS NULL
  );

-- ============================================================================
-- PASO 3: Insertar permisos de roles
-- 3a. Permisos del rol 'lider'
-- ============================================================================
INSERT INTO permisos_roles (rol, permiso)
SELECT v.rol, v.permiso FROM (VALUES
    ('lider', 'equipo:ver'),
    ('lider', 'equipo:gestionar'),
    ('lider', 'agentes:ver'),
    ('lider', 'agentes:crear'),
    ('lider', 'agentes:editar'),
    ('lider', 'agentes:desactivar'),
    ('lider', 'campañas:ver'),
    ('lider', 'campañas:crear'),
    ('lider', 'campañas:gestionar'),
    ('lider', 'campañas:asignar'),
    ('lider', 'solicitudes:importar'),
    ('lider', 'solicitudes:ver-equipo'),
    ('lider', 'solicitudes:asignar'),
    ('lider', 'solicitudes:reasignar'),
    ('lider', 'solicitudes:ver-asignaciones'),
    ('lider', 'gestiones:ver-equipo'),
    ('lider', 'dashboard:ver-equipo'),
    ('lider', 'dashboard:ver-agentes'),
    ('lider', 'relaciones:ver-equipo'),
    ('lider', 'historial:ver-equipo')
) AS v(rol, permiso)
WHERE NOT EXISTS (
    SELECT 1 FROM permisos_roles pr
    WHERE pr.rol = v.rol AND pr.permiso = v.permiso
);

-- 3b. Permisos del rol 'agente'
INSERT INTO permisos_roles (rol, permiso)
SELECT v.rol, v.permiso FROM (VALUES
    ('agente', 'campañas:ver-propias'),
    ('agente', 'solicitudes:ver-asignadas'),
    ('agente', 'solicitudes:gestionar'),
    ('agente', 'solicitudes:editar-estado'),
    ('agente', 'solicitudes:completar-info'),
    ('agente', 'gestiones:crear'),
    ('agente', 'gestiones:ver-propias'),
    ('agente', 'gestiones:editar'),
    ('agente', 'relaciones:gestionar'),
    ('agente', 'historial:ver-propio'),
    ('agente', 'perfil:ver'),
    ('agente', 'perfil:editar')
) AS v(rol, permiso)
WHERE NOT EXISTS (
    SELECT 1 FROM permisos_roles pr
    WHERE pr.rol = v.rol AND pr.permiso = v.permiso
);

-- 3c. Permisos del rol 'user' (compatibilidad con sistema actual)
INSERT INTO permisos_roles (rol, permiso)
SELECT v.rol, v.permiso FROM (VALUES
    ('user', 'solicitudes:importar'),
    ('user', 'solicitudes:ver-propias'),
    ('user', 'solicitudes:gestionar'),
    ('user', 'solicitudes:editar-estado'),
    ('user', 'solicitudes:completar-info'),
    ('user', 'campañas:crear'),
    ('user', 'campañas:gestionar'),
    ('user', 'gestiones:crear'),
    ('user', 'gestiones:ver-propias'),
    ('user', 'gestiones:editar'),
    ('user', 'relaciones:gestionar'),
    ('user', 'ventas:gestionar'),
    ('user', 'historial:ver-propio'),
    ('user', 'perfil:ver'),
    ('user', 'perfil:editar')
) AS v(rol, permiso)
WHERE NOT EXISTS (
    SELECT 1 FROM permisos_roles pr
    WHERE pr.rol = v.rol AND pr.permiso = v.permiso
);

COMMIT;
