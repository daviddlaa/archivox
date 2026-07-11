const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/admin.controller');
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
// ESTADÍSTICAS Y AUDITORÍA
// ============================================================================

// Estadísticas del sistema
router.get('/estadisticas', adminController.estadisticas);

// Logs de auditoría
router.get('/auditoria', adminController.auditoria);

module.exports = router;
