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

// Middleware de autenticación para TODAS las rutas admin
router.use(requiresAuth);

// ============================================================================
// RUTAS DE NOTIFICACIONES (ACCESIBLES POR TODOS LOS USUARIOS AUTENTICADOS)
// ============================================================================
// Estas rutas van ANTES del middleware requiresRole para que usuarios normales
// puedan ver sus notificaciones. El controlador ya filtra por destinatario.
// ============================================================================

// Listar notificaciones (filtradas para el usuario si no es admin)
router.get('/notificaciones', notificacionesController.listar);

// SSE Stream para actualizaciones en tiempo real
router.get('/notificaciones/stream', notificacionesController.streamSSE);

// Contar notificaciones no leídas
router.get('/notificaciones/no-leidas', notificacionesController.contarNoLeidas);

// Marcar notificación como leída
router.put('/notificaciones/:id/leer', notificacionesController.marcarLeida);

// Marcar todas como leídas
router.put('/notificaciones/marcar-todas-leidas', notificacionesController.marcarTodasLeidas);

// Archivar notificación
router.put('/notificaciones/:id/archivar', notificacionesController.archivar);

// ============================================================================
// MIDDLEWARE DE ROL (SOLO SUPERADMIN DE AHORA EN ADELANTE)
// ============================================================================
router.use(requiresRole('superadmin'));
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

// Promover usuario a Líder (auto-crea equipo)
router.post('/usuarios/:id/promover-lider', adminController.promoverALider);

// Revocar rol de Líder
router.post('/usuarios/:id/revocar-lider', adminController.revocarLider);

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
// NOTIFICACIONES (solo admin/superadmin)
// ============================================================================

// Crear notificación
router.post('/notificaciones', notificacionesController.crear);

// Eliminar notificación
router.delete('/notificaciones/:id', notificacionesController.eliminar);

module.exports = router;
