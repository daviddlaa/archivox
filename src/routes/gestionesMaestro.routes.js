const express = require('express');
const router = express.Router();
const controller = require('../controllers/gestionesMaestro.controller');

// Rutas para gestión maestro (gestión por lotes)

// POST /api/gestiones-maestro - Crear nueva gestión
router.post('/', controller.crearGestionMaestro);

// GET /api/gestiones-maestro - Listar todas las gestione
router.get('/', controller.listarGestionesMaestro);

// GET /api/gestiones-maestro/:id - Obtener una gestión con sus solicitudes
router.get('/:id', controller.obtenerGestionMaestro);

// PUT /api/gestiones-maestro/:id - Actualizar gestión
router.put('/:id', controller.actualizarGestionMaestro);

// DELETE /api/gestiones-maestro/:id - Eliminar gestión
router.delete('/:id', controller.eliminarGestionMaestro);

// GET /api/gestiones-maestro/:id/progreso - Obtener progreso
router.get('/:id/progreso', controller.obtenerProgresoGestion);

module.exports = router;
