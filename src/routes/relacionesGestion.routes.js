const express = require('express');
const router = express.Router();
const controller = require('../controllers/relacionesGestion.controller');
const { requiresAuth } = require('../middleware/auth.middleware');

// POST /api/relaciones/gestiones - Crear gestión
router.post('/', requiresAuth, controller.crearGestion);

// GET /api/relaciones/gestiones/ultimas?ids=1,2,3 - Batch últimas gestiones
router.get('/ultimas', requiresAuth, controller.getGestionesUltimas);

// GET /api/relaciones/gestiones/:relacion_id - Gestiones de una relación
router.get('/:relacion_id', requiresAuth, controller.getGestiones);

// DELETE /api/relaciones/gestiones/:id - Eliminar gestión
router.delete('/:id', requiresAuth, controller.eliminarGestion);

module.exports = router;
