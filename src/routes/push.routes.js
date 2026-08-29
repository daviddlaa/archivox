// ============================================================================
// RUTAS DE NOTIFICACIONES PUSH (Web Push API)
// ============================================================================
const express = require('express');
const router = express.Router();
const pushController = require('../controllers/push.controller');
const { requiresAuth } = require('../middleware/auth.middleware');

// Todas las rutas requieren sesión activa (el push es personal por usuario)
router.use(requiresAuth);

router.get('/vapid-public-key', pushController.getVapidPublicKey);
router.post('/subscribe', pushController.subscribe);
router.delete('/subscribe', pushController.unsubscribe);
router.get('/estado', pushController.estado);

module.exports = router;