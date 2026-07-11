const express = require('express');
const router = express.Router();

const relacionesController = require('../controllers/relaciones.controller');
const { requiresAuth } = require('../middleware/auth.middleware');

// REUTILIZAR configuración multer compartida (igual que excel.routes.js)
const { excel } = require('../config/multer.config');

// Rutas - usar excel (config multer compartida)
router.post('/upload', requiresAuth, excel.single('archivo'), relacionesController.uploadRelaciones);
router.get('/', requiresAuth, relacionesController.listarRelaciones);
router.get('/stats', requiresAuth, relacionesController.statsRelaciones);
router.delete('/', requiresAuth, relacionesController.limpiarRelaciones);

module.exports = router;
