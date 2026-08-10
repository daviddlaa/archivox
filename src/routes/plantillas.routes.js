const express = require('express');
const router = express.Router();

const plantillasController = require('../controllers/plantillas.controller');
const { requiresAuth } = require('../middleware/auth.middleware');

// Rutas de plantillas de mensajes (máximo 5 por usuario)
router.get('/', requiresAuth, plantillasController.listarPlantillas);
router.post('/', requiresAuth, plantillasController.crearPlantilla);
router.put('/:id', requiresAuth, plantillasController.actualizarPlantilla);
router.delete('/:id', requiresAuth, plantillasController.eliminarPlantilla);

module.exports = router;
