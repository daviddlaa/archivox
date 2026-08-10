-- ============================================================================
-- MIGRACIÓN 003b: Sistema Multi-Equipo — Seed Data (SQLite)
-- ============================================================================
-- Fecha: Julio 2026
-- Descripción: Puebla las tablas del sistema multi-equipo con datos iniciales.
--
-- Requiere ejecutar ANTES: migrations/003_create_team_tables.sqlite.sql
--
-- Ejecutar: sqlite3 database.db < migrations/003_seed_team_data.sqlite.sql
-- ============================================================================

-- ============================================================================
-- PASO 1: Crear equipo "Sistema"
-- ============================================================================
INSERT OR IGNORE INTO equipos (nombre, descripcion)
VALUES ('Sistema', 'Equipo por defecto creado durante la migración. Todos los usuarios actuales pertenecen aquí inicialmente.');

-- ============================================================================
-- PASO 2: Asignar usuarios al equipo Sistema
-- 2a. SUPERADMIN como líder del equipo
-- ============================================================================
INSERT OR IGNORE INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 1
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.is_superadmin = 1);

-- 2b. ADMIN como miembros del equipo
INSERT OR IGNORE INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND u.rol = 'admin'
  AND (u.is_superadmin IS NULL OR u.is_superadmin = 0);

-- 2c. Demás usuarios como miembros
INSERT OR IGNORE INTO equipo_usuarios (equipo_id, usuario_id, es_lider)
SELECT e.id, u.id, 0
FROM equipos e, usuarios u
WHERE e.nombre = 'Sistema'
  AND (u.rol IS NULL OR u.rol NOT IN ('admin', 'superadmin'))
  AND u.id NOT IN (
    SELECT eu.usuario_id FROM equipo_usuarios eu WHERE eu.fecha_salida IS NULL
  );

-- ============================================================================
-- PASO 3: Insertar permisos de roles
-- (INSERT OR IGNORE para evitar duplicados si se ejecuta múltiples veces)
-- ============================================================================

-- 3a. Permisos del rol 'lider'
INSERT OR IGNORE INTO permisos_roles (rol, permiso) VALUES
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
    ('lider', 'historial:ver-equipo');

-- 3b. Permisos del rol 'agente'
INSERT OR IGNORE INTO permisos_roles (rol, permiso) VALUES
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
    ('agente', 'perfil:editar');

-- 3c. Permisos del rol 'user' (compatibilidad con sistema actual)
INSERT OR IGNORE INTO permisos_roles (rol, permiso) VALUES
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
    ('user', 'perfil:editar');
