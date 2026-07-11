const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/admin.controller');
const notificacionesController = require('../controllers/notificaciones.controller');
const estadisticasController = require('../controllers/estadisticas.controller');
const { requiresAuth, requiresRole } = require('../middleware/auth.middleware');

// ============================================================================
// SEGURIDAD: Rate limiting específico para rutas admin
// ============================================================================
const adminLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // máximo 30 solicitudes por minuto
    message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ============================================================================
// RUTAS DE ADMINISTRACIÓN
// ============================================================================
// Todas las rutas requieren: autenticación + rol admin o superadmin
// ============================================================================

// Middleware de protección para todas las rutas admin
router.use(requiresAuth);
router.use(requiresRole('admin', 'superadmin'));
router.use(adminLimiter);

// ============================================================================
// GESTIÓN DE USUARIOS
// ============================================================================

// Listar usuarios con filtros y paginación
router.get('/usuarios', adminController.listarUsuarios);

// Obtener un usuario por ID
router.get('/usuarios/:id', adminController.obtenerUsuario);

// Crear un nuevo usuario
router.post('/usuarios', adminController.crearUsuario);

// Actualizar un usuario (rol, activar, nombre, email)
router.put('/usuarios/:id', adminController.actualizarUsuario);

// Activar/Desactivar un usuario
router.put('/usuarios/:id/toggle-active', adminController.toggleActivo);

// Resetear contraseña de un usuario
router.put('/usuarios/:id/reset-password', adminController.resetPassword);

// Desbloquear un usuario
router.put('/usuarios/:id/unlock', adminController.desbloquearUsuario);

// ============================================================================
// ESTADÍSTICAS
// ============================================================================

// Estadísticas globales del sistema
router.get('/estadisticas', adminController.estadisticas);

// Estadísticas detalladas por usuario (nueva arquitectura escalable)
router.get('/estadisticas/usuario/:id', estadisticasController.usuario);

// Resumen de estadísticas de todos los usuarios
router.get('/estadisticas/listado', estadisticasController.listado);

// ============================================================================
// AUDITORÍA
// ============================================================================

router.get('/auditoria', adminController.auditoria);

// ============================================================================
// NOTIFICACIONES
// ============================================================================

// IMPORTANTE: Rutas fijas ANTES de rutas con :id para evitar conflictos

// Listar notificaciones
router.get('/notificaciones', notificacionesController.listar);

// Contar notificaciones no leídas (DEBE ir antes de rutas con :id)
router.get('/notificaciones/no-leidas', notificacionesController.contarNoLeidas);

// Crear notificación (solo admin/superadmin)
router.post('/notificaciones', notificacionesController.crear);

// Marcar notificación como leída
router.put('/notificaciones/:id/leer', notificacionesController.marcarLeida);

// Eliminar notificación (DEBE ir al final para no capturar rutas fijas)
router.delete('/notificaciones/:id', notificacionesController.eliminar);

module.exports = router;
