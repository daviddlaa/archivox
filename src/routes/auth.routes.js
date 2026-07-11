const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { requiresAuth } = require('../middleware/auth.middleware');

// SEGURIDAD: Rate limiting específico para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos
    message: { error: 'Demasiados intentos de login, intenta en 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Rutas públicas
router.post('/registrar', authController.registrar);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);

// Ruta protegida - verificar sesión
router.get('/sesion', requiresAuth, authController.verificarSesion);

// Ruta para listar usuarios (solo admin/superadmin - la validación se hace en el controller)
router.get('/usuarios', requiresAuth, authController.listarUsuarios);

module.exports = router;
