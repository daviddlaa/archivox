// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN (CENTRALIZADO)
// ============================================================================
// Único punto de definición para todos los middlewares de seguridad.
// Arquitectura multi-equipo v3.0: soporta permisos en BD y por equipo.
// ============================================================================

const { tienePermiso, tieneNivelMinimo, tienePermisoBD, tienePermisoCompleto } = require('../config/permissions');

/**
 * Middleware: Verifica que el usuario esté autenticado (para APIs REST).
 * Responde con 401 si no hay sesión.
 */
function requiresAuth(req, res, next) {
    if (req.session?.usuario) {
        return next();
    }
    return res.status(401).json({
        error: 'No autenticado'
    });
}

/**
 * Middleware: Verifica que el usuario sea SuperAdmin (is_superadmin === true).
 * ⚠️ Flujo completamente separado del dashboard operativo.
 * El SuperAdmin NO tiene acceso a rutas operativas.
 * Responde con 403 si no es SuperAdmin.
 */
function requiresSuperAdmin(req, res, next) {
    if (!req.session?.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    if (req.session.usuario.is_superadmin) {
        return next();
    }
    return res.status(403).json({
        error: 'Acceso denegado: solo SuperAdmin',
        tu_rol: req.session.usuario.rol
    });
}

/**
 * Middleware: Verifica que el usuario esté autenticado (para páginas HTML).
 * Redirecciona al login si no hay sesión.
 */
function requireAuthPage(req, res, next) {
    if (req.session?.usuario) {
        return next();
    }
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(req.headers['user-agent']);
    if (isMobile || req.query.movil === '1') {
        return res.redirect('/m/login');
    }
    return res.redirect('/login');
}

/**
 * Middleware: Verifica que el usuario tenga uno de los roles especificados.
 * Uso: router.get('/ruta', requiresRole('admin', 'superadmin'), handler)
 */
function requiresRole(...roles) {
    return (req, res, next) => {
        if (!req.session?.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        const userRole = req.session.usuario.rol;
        if (!roles.includes(userRole)) {
            return res.status(403).json({
                error: 'Acceso denegado: rol insuficiente',
                rol_requerido: roles.join(' o '),
                tu_rol: userRole
            });
        }
        return next();
    };
}

/**
 * Middleware: Verifica que el usuario tenga un permiso específico (síncrono).
 * Uso: router.get('/ruta', requiresPermission('users:read'), handler)
 */
function requiresPermission(permiso) {
    return (req, res, next) => {
        if (!req.session?.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        const userRole = req.session.usuario.rol;
        if (!tienePermiso(userRole, permiso)) {
            return res.status(403).json({
                error: 'Acceso denegado: permiso insuficiente',
                permiso_requerido: permiso,
                tu_rol: userRole
            });
        }
        return next();
    };
}

/**
 * Middleware: Verifica que el usuario tenga un permiso específico (ASÍNCRONO).
 * Consulta la tabla permisos_roles en BD para los roles dinámicos.
 * Uso: router.get('/ruta', requiresPermissionAsync('campañas:crear'), handler)
 */
function requiresPermissionAsync(permiso) {
    return async (req, res, next) => {
        if (!req.session?.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const userRole = req.session.usuario.rol;
        const equipoId = req.session.usuario.equipo_id || null;

        try {
            const tiene = await tienePermisoCompleto(userRole, equipoId, permiso);
            if (tiene) return next();

            return res.status(403).json({
                error: 'Acceso denegado: permiso insuficiente',
                permiso_requerido: permiso,
                tu_rol: userRole
            });
        } catch (err) {
            console.error('[Auth] Error en requiresPermissionAsync:', err.message);
            return res.status(500).json({ error: 'Error interno al verificar permisos' });
        }
    };
}

/**
 * Middleware: Verifica que el usuario tenga al menos el nivel de rol especificado.
 * Niveles: superadmin=100, admin=50, lider=30, agente=20, user=10
 */
function requiresLevel(minLevel) {
    return (req, res, next) => {
        if (!req.session?.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        const userRole = req.session.usuario.rol;
        if (!tieneNivelMinimo(userRole, minLevel)) {
            return res.status(403).json({
                error: 'Acceso denegado: nivel insuficiente',
                nivel_requerido: minLevel,
                tu_rol: userRole
            });
        }
        return next();
    };
}

/**
 * Middleware: Verifica que el usuario pertenezca al equipo especificado.
 * Uso: router.get('/ruta', requiresEquipo('ver'), handler)
 *       router.get('/ruta/:equipo_id', requiresEquipo('gestionar'), handler)
 */
function requiresEquipo(accion = 'ver') {
    return (req, res, next) => {
        if (!req.session?.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const user = req.session.usuario;

        // superadmin y admin pueden ver cualquier equipo
        if (user.rol === 'superadmin' || user.rol === 'admin') {
            return next();
        }

        // El equipo_id puede venir de params (:id o :equipo_id), body o de la sesión
        const equipoIdRequerido = parseInt(req.params.equipo_id || req.params.id || req.body.equipo_id) || user.equipo_id;

        // Si el usuario no tiene equipo, no puede acceder
        if (!user.equipo_id) {
            return res.status(403).json({ error: 'No perteneces a ningún equipo' });
        }

        // El usuario solo puede acceder a su propio equipo
        if (user.equipo_id !== equipoIdRequerido) {
            return res.status(403).json({
                error: 'No tienes acceso a este equipo',
                tu_equipo: user.equipo_nombre
            });
        }

        return next();
    };
}

/**
 * Helper: Obtiene el ID del usuario actual desde la sesión.
 */
function getUsuarioId(req) {
    return req.session?.usuario?.id || null;
}

/**
 * Helper: Obtiene el rol del usuario actual desde la sesión.
 */
function getRol(req) {
    return req.session?.usuario?.rol || null;
}

/**
 * Helper: Obtiene el equipo del usuario actual desde la sesión.
 */
function getEquipoId(req) {
    return req.session?.usuario?.equipo_id || null;
}

module.exports = {
    requiresAuth,
    requireAuthPage,
    requiresRole,
    requiresPermission,
    requiresPermissionAsync,
    requiresLevel,
    requiresEquipo,
    requiresSuperAdmin,
    getUsuarioId,
    getRol,
    getEquipoId
};
