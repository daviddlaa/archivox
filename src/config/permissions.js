// ============================================================================
// CONFIGURACIÓN DE ROLES Y PERMISOS
// ============================================================================
// Define los roles disponibles y sus permisos asociados.
// Sistema extensible: para agregar un nuevo rol, solo agrégalo aquí.
//
// Convención de permisos:  <recurso>:<acción>
//   recurso: users, system, audit, data, auth
//   acción:  read, write, delete, admin, *, create
//   *  = todas las acciones sobre ese recurso
//   :*  = todas las acciones (wildcard)
// ============================================================================

const ROLES = {
    superadmin: {
        level: 100,
        label: 'Super Administrador',
        description: 'Control total del sistema. Puede gestionar administradores.',
        permissions: [
            'users:*',    // CRUD completo de usuarios + cambiar roles
            'system:*',   // Configuración del sistema
            'audit:*',    // Logs de auditoría completos
            'data:*',     // Todos los datos del sistema
            'auth:impersonate' // Puede ver como otro usuario
        ]
    },
    admin: {
        level: 50,
        label: 'Administrador',
        description: 'Panel de administración y gestión de usuarios.',
        permissions: [
            'users:read',    // Ver lista de usuarios
            'users:write',   // Editar usuarios (excepto superadmin)
            'system:read',   // Ver configuración
            'audit:read',    // Ver logs de auditoría
            'data:*'         // Todos los datos del sistema
        ]
    },
    user: {
        level: 10,
        label: 'Usuario',
        description: 'Funciones normales del sistema.',
        permissions: [
            'data:read',     // Ver sus propios datos
            'data:write'     // Gestionar sus propios datos
        ]
    }
};

/**
 * Verifica si un rol tiene un permiso específico.
 * Soporta wildcards: 'users:*' concede todos los permisos que empiecen con 'users:'
 */
function tienePermiso(rol, permisoRequerido) {
    const config = ROLES[rol];
    if (!config) return false;

    return config.permissions.some(permiso => {
        // Coincidencia exacta
        if (permiso === permisoRequerido) return true;
        if (permiso === '*') return true;

        // Wildcard: 'users:*' → coincide con 'users:read', 'users:write', etc.
        if (permiso.endsWith(':*')) {
            const prefijo = permiso.replace(':*', ':');
            return permisoRequerido.startsWith(prefijo);
        }

        return false;
    });
}

/**
 * Verifica si un rol tiene al menos el nivel especificado.
 * superadmin (100) > admin (50) > user (10)
 */
function tieneNivelMinimo(rol, nivelMinimo) {
    const config = ROLES[rol];
    if (!config) return false;
    return config.level >= nivelMinimo;
}

module.exports = {
    ROLES,
    tienePermiso,
    tieneNivelMinimo
};
