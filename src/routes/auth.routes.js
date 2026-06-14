const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
// IMPORTANTE: Usar src/controllers/auth.controller.js que funciona con SQLite y PostgreSQL
const authController = require('../controllers/auth.controller');

// Middleware para verificar autenticación
function requiresAuth(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.status(401).json({
        error: 'No autenticado'
    });
}

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

// Ruta para listar usuarios (solo admin)
router.get('/usuarios', requiresAuth, authController.listarUsuarios);

module.exports = router;
