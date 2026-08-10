// ============================================================================
// CONFIGURACIÓN DE ROLES Y PERMISOS
// ============================================================================
// Define los roles disponibles y sus permisos asociados.
// Sistema extensible: para agregar un nuevo rol, solo agrégalo aquí.
//
// Convención de permisos:  <recurso>:<acción>
//   recurso: equipo, agentes, campañas, solicitudes, gestiones, dashboard,
//            relaciones, ventas, historial, usuarios, sistema, importar
//   acción:  ver, crear, gestionar, eliminar, asignar, reasignar, *
//            ver-propias, ver-equipo (filtros de visibilidad)
//   *  = todas las acciones sobre ese recurso
//
// Arquitectura multi-equipo v3.0:
//   - superadmin (level 100): Todo el sistema
//   - admin (level 50): Panel administración
//   - lider (level 30): Gestiona su equipo y agentes
//   - agente (level 20): Operaciones sobre asignaciones
//   - user (level 10): Comportamiento actual (compatibilidad)
// ============================================================================

const pool = require('./db.js');

const ROLES = {
    superadmin: {
        level: 100,
        label: 'Super Administrador',
        description: 'Control total del sistema. Puede gestionar usuarios, líderes y agentes.',
        permissions: [
            'users:*',
            'system:*',
            'audit:*',
            'data:*',
            'auth:impersonate',
            'equipos:*',
            'agentes:*',
            'campañas:*',
            'asignaciones:*'
        ]
    },
    lider: {
        level: 30,
        label: 'Líder de Equipo',
        description: 'Gestiona su equipo, crea agentes, asigna solicitudes.',
        permissions: [
            'equipo:ver',
            'equipo:gestionar',
            'agentes:reset-password',
            'data:read',
            'data:write'
        ]
    },
    agente: {
        level: 20,
        label: 'Agente',
        description: 'Opera sobre solicitudes y campañas asignadas.',
        permissions: [
            'data:read',
            'data:write'
        ]
    },
    user: {
        level: 10,
        label: 'Usuario',
        description: 'Funciones normales del sistema (compatibilidad).',
        permissions: [
            'data:read',
            'data:write'
        ]
    }
};

/**
 * Verifica si un rol tiene un permiso específico (síncrono, en memoria).
 * Soporta wildcards: 'users:*' concede todos los permisos que empiecen con 'users:'
 */
function tienePermiso(rol, permisoRequerido) {
    const config = ROLES[rol];
    if (!config) return false;

    // superadmin siempre tiene todos los permisos
    if (rol === 'superadmin') return true;

    return config.permissions.some(permiso => {
        if (permiso === permisoRequerido) return true;
        if (permiso === '*') return true;
        if (permiso.endsWith(':*')) {
            const prefijo = permiso.replace(':*', ':');
            return permisoRequerido.startsWith(prefijo);
        }
        return false;
    });
}

/**
 * Verifica si un rol tiene al menos el nivel especificado.
 * superadmin (100) > admin (50) > lider (30) > agente (20) > user (10)
 */
function tieneNivelMinimo(rol, nivelMinimo) {
    const config = ROLES[rol];
    if (!config) return false;
    return config.level >= nivelMinimo;
}

/**
 * Verifica permiso en BD (para roles dinámicos como lider y agente).
 * superadmin tiene permisos implícitos + verifican BD.
 * Consulta la tabla permisos_roles.
 */
async function tienePermisoBD(rol, permisoRequerido) {
    // superadmin siempre tiene todo
    if (rol === 'superadmin') return true;

    // Verificar primero en memoria (roles conocidos)
    if (tienePermiso(rol, permisoRequerido)) return true;

    // Consultar BD para permisos específicos
    try {
        const result = await pool.query(
            'SELECT 1 FROM permisos_roles WHERE rol = $1 AND permiso = $2 LIMIT 1',
            [rol, permisoRequerido]
        );
        return result.rows.length > 0;
    } catch (err) {
        // Si la tabla no existe (migración no ejecutada), fallback a permisos en memoria
        console.warn('[Permissions] Error consultando permisos_roles:', err.message);
        return false;
    }
}

/**
 * Verifica si un equipo tiene un permiso específico (permiso extra).
 * Consulta la tabla permisos_equipo.
 */
async function tienePermisoEquipo(equipoId, permisoRequerido) {
    if (!equipoId) return false;
    try {
        const result = await pool.query(
            'SELECT 1 FROM permisos_equipo WHERE equipo_id = $1 AND permiso = $2 LIMIT 1',
            [equipoId, permisoRequerido]
        );
        return result.rows.length > 0;
    } catch (err) {
        return false;
    }
}

/**
 * Verifica permisos combinados: rol base + permisos_roles + permisos_equipo.
 */
async function tienePermisoCompleto(rol, equipoId, permisoRequerido) {
    // 1. superadmin siempre pasa
    if (rol === 'superadmin') return true;

    // 2. Verificar en permisos_roles
    const porRol = await tienePermisoBD(rol, permisoRequerido);
    if (porRol) return true;

    // 3. Verificar en permisos_equipo
    const porEquipo = await tienePermisoEquipo(equipoId, permisoRequerido);
    if (porEquipo) return true;

    return false;
}

module.exports = {
    ROLES,
    tienePermiso,
    tieneNivelMinimo,
    tienePermisoBD,
    tienePermisoEquipo,
    tienePermisoCompleto
};
