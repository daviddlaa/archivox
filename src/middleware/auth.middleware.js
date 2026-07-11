// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN (CENTRALIZADO)
// ============================================================================
// Único punto de definición para todos los middlewares de seguridad.
// Reemplaza las 6 definiciones duplicadas de requiresAuth que existían antes.
// ============================================================================

const { tienePermiso, tieneNivelMinimo } = require('../config/permissions');

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
 * Middleware: Verifica que el usuario esté autenticado (para páginas HTML).
 * Redirecciona al login si no hay sesión.
 */
function requireAuthPage(req, res, next) {
    if (req.session?.usuario) {
        return next();
    }
    // Redireccionar a login según el dispositivo
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
 * Middleware: Verifica que el usuario tenga un permiso específico.
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
 * Middleware: Verifica que el usuario tenga al menos el nivel de rol especificado.
 * Niveles: superadmin=100, admin=50, user=10
 * Uso: router.get('/ruta', requiresLevel(50), handler)
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

module.exports = {
    requiresAuth,
    requireAuthPage,
    requiresRole,
    requiresPermission,
    requiresLevel,
    getUsuarioId,
    getRol
};
