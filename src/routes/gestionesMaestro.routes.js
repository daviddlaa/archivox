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

// PUT /api/gestiones-maestro/:id/agregar-solicitudes - Agregar solicitudes a una campaña
router.put('/:id/agregar-solicitudes', controller.agregarSolicitudesACampana);

// PUT /api/gestiones-maestro/:id/quitar-solicitud - Quitar una solicitud de una campaña
router.put('/:id/quitar-solicitud', controller.quitarSolicitudDeCampana);

// PUT /api/gestiones-maestro/:id/asignar-agente - Asignar campaña a un agente
router.put('/:id/asignar-agente', controller.asignarAgenteACampana);

// PUT /api/gestiones-maestro/:id/quitar-asignacion - Quitar asignación de agente
router.put('/:id/quitar-asignacion', controller.quitarAsignacionAgente);

module.exports = router;
