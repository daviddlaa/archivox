const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const relacionesController = require('../controllers/relaciones.controller');

// Configurar multer para subir Excel de relaciones
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'relaciones-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel: .xlsx, .xls'));
        }
    }
});

// Middleware de autenticación
function requiresAuth(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.status(401).json({ error: 'No autenticado' });
}

// Rutas
router.post('/upload', requiresAuth, upload.single('archivo'), relacionesController.uploadRelaciones);
router.get('/', requiresAuth, relacionesController.listarRelaciones);
router.get('/stats', requiresAuth, relacionesController.statsRelaciones);
router.delete('/', requiresAuth, relacionesController.limpiarRelaciones);

module.exports = router;
