const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const relacionesController = require('../controllers/relaciones.controller');

// REUTILIZAR configuración multer compartida (igual que excel.routes.js)
// Esto asegura consistencia con el resto del sistema
const { excel } = require('../config/multer.config');

// Middleware de autenticación
function requiresAuth(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.status(401).json({ error: 'No autenticado' });
}

// Rutas - usar excel (config multer compartida)
router.post('/upload', requiresAuth, excel.single('archivo'), relacionesController.uploadRelaciones);
router.get('/', requiresAuth, relacionesController.listarRelaciones);
router.get('/stats', requiresAuth, relacionesController.statsRelaciones);
router.delete('/', requiresAuth, relacionesController.limpiarRelaciones);

module.exports = router;
